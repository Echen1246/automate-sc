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
  getSessionConfig,
  getSessionAnalytics,
  updateSessionConfig,
  updateSessionAnalytics,
  resetSessionAnalytics,
  createSessionId,
  updateSessionMeta,
  deleteSession,
  ensureSessionsDir,
  DEFAULT_CONFIG,
  DEFAULT_ANALYTICS,
  type SessionConfig,
} from './sessions.js';
import { launchForLogin, saveSession, closeBrowser } from './core/browser.js';

const app = express();
const PORT = 3847;

app.use(cors());
app.use(express.json());

// Serve static dashboard files
app.use(express.static(resolve(process.cwd(), 'dashboard', 'dist')));

// =========================================
// TYPES
// =========================================

interface BotStats {
  messagesReceived: number;
  messagesSent: number;
  conversationsHandled: number;
  avgResponseTime: number;
  startedAt: string | null;
  lastActivity: string | null;
}

interface BotProcess {
  process: ChildProcess;
  sessionId: string;
  status: 'starting' | 'running' | 'paused' | 'stopping' | 'stopped' | 'error';
  stats: BotStats;
}

// =========================================
// STATE
// =========================================

const activeBots = new Map<string, BotProcess>();
let loginBrowser: Awaited<ReturnType<typeof launchForLogin>> | null = null;
let pendingLoginName: string | null = null;

// =========================================
// WORKER MESSAGE HANDLING
// =========================================

function handleWorkerMessage(sessionId: string, msg: Record<string, unknown>): void {
  const bot = activeBots.get(sessionId);
  if (!bot) return;

  const msgType = msg.type as string;
  const msgStats = msg.stats as BotStats | undefined;

  if (msgStats) {
    bot.stats = msgStats;
  }

  switch (msgType) {
    case 'status':
      bot.status = msg.status as BotProcess['status'];
      break;
    case 'message_received':
      updateSessionAnalytics(sessionId, 'received');
      break;
    case 'message_sent':
      updateSessionAnalytics(
        sessionId,
        'sent',
        typeof msg.responseTime === 'number' ? msg.responseTime : undefined
      );
      break;
    case 'error':
      bot.status = 'error';
      logger.error('Worker error', { sessionId, message: msg.message });
      break;
  }
}

function parseWorkerOutput(sessionId: string, data: string): void {
  const lines = data.split('\n');
  for (const line of lines) {
    const match = line.match(/__WORKER_MSG__(.+)__END__/);
    if (match) {
      try {
        const msg = JSON.parse(match[1]);
        handleWorkerMessage(sessionId, msg);
      } catch {
        // Not a worker message
      }
    }
  }
}

// =========================================
// SESSION ENDPOINTS
// =========================================

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

// Get session config
app.get('/api/sessions/:id/config', (req, res) => {
  const config = getSessionConfig(req.params.id);
  if (!config) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  res.json(config);
});

// Update session config
app.post('/api/sessions/:id/config', (req, res) => {
  const sessionId = req.params.id;
  const updates = req.body as Partial<SessionConfig>;
  
  const newConfig = updateSessionConfig(sessionId, updates);
  if (!newConfig) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  
  // If bot is running, send config update
  const bot = activeBots.get(sessionId);
  if (bot && bot.process.send) {
    bot.process.send({ type: 'config', config: newConfig });
    logger.info('Config sent to running bot', { sessionId });
  }
  
  res.json({ success: true, config: newConfig });
});

// Get session analytics
app.get('/api/sessions/:id/analytics', (req, res) => {
  const analytics = getSessionAnalytics(req.params.id);
  if (!analytics) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  
  const avgResponseTime = analytics.responseTimes.length > 0
    ? Math.round(analytics.responseTimes.reduce((a, b) => a + b, 0) / analytics.responseTimes.length)
    : 0;

  const replyRate = analytics.totalReceived > 0
    ? Math.round((analytics.totalSent / analytics.totalReceived) * 100)
    : 0;

  res.json({
    ...analytics,
    avgResponseTime,
    replyRate,
  });
});

// Reset session analytics
app.post('/api/sessions/:id/analytics/reset', (req, res) => {
  resetSessionAnalytics(req.params.id);
  res.json({ success: true });
});

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
      bot.process.send?.({ type: 'resume' });
      bot.status = 'running';
      res.json({ success: true, status: 'running' });
      return;
    }
    res.status(400).json({ error: 'Bot already running' });
    return;
  }

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
      conversationsHandled: 0,
      avgResponseTime: 0,
      startedAt: new Date().toISOString(),
      lastActivity: null,
    },
  };

  activeBots.set(sessionId, botProcess);

  // Handle IPC messages
  child.on('message', (msg: Record<string, unknown>) => {
    handleWorkerMessage(sessionId, msg);
    
    // Send initial config when worker is ready
    if (msg.type === 'status' && msg.status === 'running') {
      const config = getSessionConfig(sessionId);
      if (config && child.send) {
        child.send({ type: 'config', config });
        logger.info('Initial config sent to bot', { sessionId });
      }
    }
  });

  // Handle stdout (fallback for non-IPC)
  child.stdout?.on('data', (data) => {
    const output = data.toString();
    parseWorkerOutput(sessionId, output);
    const cleanOutput = output.replace(/__WORKER_MSG__.+__END__/g, '').trim();
    if (cleanOutput) {
      console.log(`[Bot:${sessionId}] ${cleanOutput}`);
    }
  });

  child.stderr?.on('data', (data) => {
    console.error(`[Bot:${sessionId}] ${data.toString()}`);
  });

  child.on('exit', (code) => {
    logger.info('Bot process exited', { sessionId, code });
    botProcess.status = 'stopped';
    activeBots.delete(sessionId);
  });

  updateSessionMeta(sessionId, { lastUsed: new Date().toISOString() });
  res.json({ success: true, status: 'starting' });
});

app.post('/api/sessions/:id/stop', (req, res) => {
  const sessionId = req.params.id;
  const bot = activeBots.get(sessionId);

  if (!bot) {
    res.status(400).json({ error: 'Bot not running' });
    return;
  }

  logger.info('Stopping bot', { sessionId });
  bot.status = 'stopping';
  bot.process.send?.({ type: 'stop' });

  setTimeout(() => {
    if (activeBots.has(sessionId)) {
      bot.process.kill('SIGTERM');
      activeBots.delete(sessionId);
    }
  }, 5000);

  res.json({ success: true, status: 'stopping' });
});

app.post('/api/sessions/:id/pause', (req, res) => {
  const sessionId = req.params.id;
  const bot = activeBots.get(sessionId);

  if (!bot || bot.status !== 'running') {
    res.status(400).json({ error: 'Bot not running' });
    return;
  }

  bot.process.send?.({ type: 'pause' });
  bot.status = 'paused';
  res.json({ success: true, status: 'paused' });
});

app.post('/api/sessions/:id/resume', (req, res) => {
  const sessionId = req.params.id;
  const bot = activeBots.get(sessionId);

  if (!bot || bot.status !== 'paused') {
    res.status(400).json({ error: 'Bot not paused' });
    return;
  }

  bot.process.send?.({ type: 'resume' });
  bot.status = 'running';
  res.json({ success: true, status: 'running' });
});

app.delete('/api/sessions/:id', (req, res) => {
  const sessionId = req.params.id;

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
    logger.error('Failed to start login', { error });
    res.status(500).json({ error: 'Failed to open browser' });
  }
});

app.post('/api/login/complete', async (_req, res) => {
  if (!loginBrowser || !pendingLoginName) {
    res.status(400).json({ error: 'No login in progress' });
    return;
  }

  try {
    const sessionId = createSessionId(pendingLoginName);
    const sessionPath = getSessionPath(sessionId);

    ensureSessionsDir();

    const state = await loginBrowser.context.storageState();
    const stateWithMeta = {
      ...state,
      _meta: {
        name: pendingLoginName,
        createdAt: new Date().toISOString(),
        lastUsed: null,
      },
      _config: DEFAULT_CONFIG,
      _analytics: DEFAULT_ANALYTICS,
    };

    writeFileSync(sessionPath, JSON.stringify(stateWithMeta, null, 2));
    logger.info('Session saved', { sessionId, name: pendingLoginName });

    await closeBrowser(loginBrowser);
    loginBrowser = null;
    pendingLoginName = null;

    res.json({ success: true, sessionId });
  } catch (error) {
    logger.error('Failed to complete login', { error });
    res.status(500).json({ error: 'Failed to save session' });
  }
});

app.post('/api/login/cancel', async (_req, res) => {
  if (loginBrowser) {
    await closeBrowser(loginBrowser);
    loginBrowser = null;
    pendingLoginName = null;
  }
  res.json({ success: true });
});

app.get('/api/login/status', (_req, res) => {
  res.json({
    inProgress: loginBrowser !== null,
    name: pendingLoginName,
  });
});

// =========================================
// GLOBAL STATS (summary across all sessions)
// =========================================

app.get('/api/stats', (_req, res) => {
  const sessions = getSessions();
  let totalReceived = 0;
  let totalSent = 0;
  
  for (const session of sessions) {
    totalReceived += session.analytics.totalReceived;
    totalSent += session.analytics.totalSent;
  }
  
  res.json({
    activeBots: activeBots.size,
    totalSessions: sessions.length,
    totalReceived,
    totalSent,
  });
});

// =========================================
// SPA FALLBACK
// =========================================

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

process.on('SIGINT', async () => {
  logger.info('Shutting down server');

  for (const [sessionId, bot] of activeBots) {
    logger.info('Stopping bot', { sessionId });
    bot.process.kill('SIGTERM');
  }

  if (loginBrowser) {
    await closeBrowser(loginBrowser);
  }

  process.exit(0);
});

main();
