// Main dashboard server - manages bot processes and serves UI

import express from 'express';
import cors from 'cors';
import { resolve } from 'path';
import { spawn, type ChildProcess } from 'child_process';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { logger } from './utils/logger.js';
import {
  getSessions,
  getSession,
  getSessionPath,
  createSessionId,
  updateSessionMeta,
  deleteSession,
  ensureSessionsDir,
  type SessionInfo,
} from './sessions.js';
import { launchForLogin, saveSession, closeBrowser } from './core/browser.js';
import { SYSTEM_PROMPT } from './ai/prompts.js';

const app = express();
const PORT = 3847;

app.use(cors());
app.use(express.json());

// Serve static dashboard files
app.use(express.static(resolve(process.cwd(), 'dashboard', 'dist')));

// Active bot processes
interface BotProcess {
  process: ChildProcess;
  sessionId: string;
  status: 'starting' | 'running' | 'paused' | 'stopping' | 'stopped' | 'error';
  stats: {
    messagesReceived: number;
    messagesSent: number;
    startedAt: string | null;
    lastActivity: string | null;
  };
}

const activeBots = new Map<string, BotProcess>();

// Login browser instance (only one at a time)
let loginBrowser: Awaited<ReturnType<typeof launchForLogin>> | null = null;
let pendingLoginName: string | null = null;

// =========================================
// SESSION ENDPOINTS
// =========================================

// Get all sessions with their bot status
app.get('/api/sessions', (_req, res) => {
  const sessions = getSessions();
  
  const result = sessions.map((session) => {
    const bot = activeBots.get(session.id);
    return {
      ...session,
      status: bot?.status || 'stopped',
      stats: bot?.stats || null,
    };
  });
  
  res.json(result);
});

// Get single session
app.get('/api/sessions/:id', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  
  const bot = activeBots.get(session.id);
  res.json({
    ...session,
    status: bot?.status || 'stopped',
    stats: bot?.stats || null,
  });
});

// Start bot for session
app.post('/api/sessions/:id/start', (req, res) => {
  const sessionId = req.params.id;
  const session = getSession(sessionId);
  
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  
  if (activeBots.has(sessionId)) {
    const bot = activeBots.get(sessionId)!;
    if (bot.status === 'paused') {
      // Resume
      bot.process.send({ type: 'resume' });
      bot.status = 'running';
      res.json({ success: true, status: 'running' });
      return;
    }
    res.status(400).json({ error: 'Bot already running' });
    return;
  }
  
  // Spawn worker process
  logger.info('Starting bot', { sessionId });
  
  const workerPath = resolve(process.cwd(), 'src', 'worker.ts');
  const child = spawn('npx', ['tsx', workerPath, session.path, sessionId], {
    stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    env: { ...process.env },
  });
  
  const botProcess: BotProcess = {
    process: child,
    sessionId,
    status: 'starting',
    stats: {
      messagesReceived: 0,
      messagesSent: 0,
      startedAt: new Date().toISOString(),
      lastActivity: null,
    },
  };
  
  activeBots.set(sessionId, botProcess);
  
  // Handle worker output
  child.stdout?.on('data', (data) => {
    const line = data.toString().trim();
    if (line.startsWith('[WORKER]')) {
      try {
        const json = JSON.parse(line.replace('[WORKER] ', ''));
        if (json.type === 'status') {
          botProcess.status = json.status;
          if (json.stats) {
            botProcess.stats = json.stats;
          }
        }
      } catch {
        // Regular log output
        console.log(`[Bot ${sessionId}] ${line}`);
      }
    } else {
      console.log(`[Bot ${sessionId}] ${line}`);
    }
  });
  
  child.stderr?.on('data', (data) => {
    console.error(`[Bot ${sessionId}] ${data.toString()}`);
  });
  
  child.on('exit', (code) => {
    logger.info('Bot process exited', { sessionId, code });
    botProcess.status = 'stopped';
    activeBots.delete(sessionId);
  });
  
  // Update last used
  updateSessionMeta(sessionId, { lastUsed: new Date().toISOString() });
  
  res.json({ success: true, status: 'starting' });
});

// Stop bot
app.post('/api/sessions/:id/stop', (req, res) => {
  const sessionId = req.params.id;
  const bot = activeBots.get(sessionId);
  
  if (!bot) {
    res.status(400).json({ error: 'Bot not running' });
    return;
  }
  
  logger.info('Stopping bot', { sessionId });
  bot.status = 'stopping';
  bot.process.send({ type: 'stop' });
  
  // Force kill after timeout
  setTimeout(() => {
    if (activeBots.has(sessionId)) {
      bot.process.kill('SIGTERM');
      activeBots.delete(sessionId);
    }
  }, 5000);
  
  res.json({ success: true, status: 'stopping' });
});

// Pause bot
app.post('/api/sessions/:id/pause', (req, res) => {
  const sessionId = req.params.id;
  const bot = activeBots.get(sessionId);
  
  if (!bot || bot.status !== 'running') {
    res.status(400).json({ error: 'Bot not running' });
    return;
  }
  
  bot.process.send({ type: 'pause' });
  bot.status = 'paused';
  
  res.json({ success: true, status: 'paused' });
});

// Resume bot
app.post('/api/sessions/:id/resume', (req, res) => {
  const sessionId = req.params.id;
  const bot = activeBots.get(sessionId);
  
  if (!bot || bot.status !== 'paused') {
    res.status(400).json({ error: 'Bot not paused' });
    return;
  }
  
  bot.process.send({ type: 'resume' });
  bot.status = 'running';
  
  res.json({ success: true, status: 'running' });
});

// Delete session
app.delete('/api/sessions/:id', (req, res) => {
  const sessionId = req.params.id;
  
  // Stop bot if running
  const bot = activeBots.get(sessionId);
  if (bot) {
    bot.process.kill('SIGTERM');
    activeBots.delete(sessionId);
  }
  
  const deleted = deleteSession(sessionId);
  if (!deleted) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  
  res.json({ success: true });
});

// =========================================
// LOGIN ENDPOINTS
// =========================================

// Start new login session
app.post('/api/login/start', async (req, res) => {
  const { name } = req.body;
  
  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'Name required' });
    return;
  }
  
  if (loginBrowser) {
    res.status(400).json({ error: 'Login already in progress' });
    return;
  }
  
  try {
    logger.info('Starting login flow', { name });
    pendingLoginName = name;
    loginBrowser = await launchForLogin();
    
    await loginBrowser.page.goto('https://web.snapchat.com/', {
      waitUntil: 'domcontentloaded',
    });
    
    res.json({ success: true, message: 'Browser opened. Please log in.' });
  } catch (error) {
    logger.error('Failed to start login', error);
    res.status(500).json({ error: 'Failed to open browser' });
  }
});

// Complete login (save session)
app.post('/api/login/complete', async (_req, res) => {
  if (!loginBrowser || !pendingLoginName) {
    res.status(400).json({ error: 'No login in progress' });
    return;
  }
  
  try {
    // Create session ID and path
    const sessionId = createSessionId(pendingLoginName);
    const sessionPath = getSessionPath(sessionId);
    
    // Ensure directory exists
    ensureSessionsDir();
    
    // Save session with metadata
    const state = await loginBrowser.context.storageState();
    const stateWithMeta = {
      ...state,
      _meta: {
        name: pendingLoginName,
        createdAt: new Date().toISOString(),
        lastUsed: null,
      },
    };
    
    writeFileSync(sessionPath, JSON.stringify(stateWithMeta, null, 2));
    logger.info('Session saved', { sessionId, name: pendingLoginName });
    
    // Close browser
    await closeBrowser(loginBrowser);
    loginBrowser = null;
    pendingLoginName = null;
    
    res.json({ success: true, sessionId });
  } catch (error) {
    logger.error('Failed to complete login', error);
    res.status(500).json({ error: 'Failed to save session' });
  }
});

// Cancel login
app.post('/api/login/cancel', async (_req, res) => {
  if (loginBrowser) {
    await closeBrowser(loginBrowser);
    loginBrowser = null;
    pendingLoginName = null;
  }
  res.json({ success: true });
});

// Get login status
app.get('/api/login/status', (_req, res) => {
  res.json({
    inProgress: loginBrowser !== null,
    name: pendingLoginName,
  });
});

// =========================================
// CONFIG ENDPOINTS (for active bot)
// =========================================

// Get global config
app.get('/api/config', (_req, res) => {
  res.json({
    personality: SYSTEM_PROMPT,
    // Add more config as needed
  });
});

// Fallback to index.html for SPA routing
app.use((_req, res) => {
  const indexPath = resolve(process.cwd(), 'dashboard', 'dist', 'index.html');
  if (existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Dashboard not built. Run: npm run build:dashboard');
  }
});

// =========================================
// START SERVER
// =========================================

function main(): void {
  ensureSessionsDir();
  
  app.listen(PORT, () => {
    logger.info(`Dashboard server running at http://localhost:${PORT}`);
    console.log(`\nOpen http://localhost:${PORT} in your browser\n`);
  });
}

// Handle shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down server');
  
  // Stop all bots
  for (const [sessionId, bot] of activeBots) {
    logger.info('Stopping bot', { sessionId });
    bot.process.kill('SIGTERM');
  }
  
  // Close login browser if open
  if (loginBrowser) {
    await closeBrowser(loginBrowser);
  }
  
  process.exit(0);
});

main();

