// Main dashboard server - manages bot processes and serves UI

import express from 'express';
import cors from 'cors';
import { resolve } from 'path';
import { spawn, type ChildProcess } from 'child_process';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { logger } from './utils/logger.js';
import {
  getSessions,
  getSession,
  getSessionPath,
  createSessionId,
  updateSessionMeta,
  deleteSession,
  ensureSessionsDir,
} from './sessions.js';
import { launchForLogin, saveSession, closeBrowser } from './core/browser.js';
import { SYSTEM_PROMPT } from './ai/prompts.js';

const app = express();
const PORT = 3847;
const ANALYTICS_PATH = resolve(process.cwd(), 'data', 'analytics.json');

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

interface HourlyData {
  hour: string;
  received: number;
  sent: number;
}

interface Analytics {
  hourlyData: HourlyData[];
  totalReceived: number;
  totalSent: number;
  responseTimes: number[];
  lastUpdated: string;
}

interface GlobalConfig {
  personality: string;
  scheduleEnabled: boolean;
  scheduleStart: number;
  scheduleEnd: number;
  skipWeekends: boolean;
  responseDelayMin: number;
  responseDelayMax: number;
  maxRepliesPerHour: number;
}

// =========================================
// STATE
// =========================================

const activeBots = new Map<string, BotProcess>();
let loginBrowser: Awaited<ReturnType<typeof launchForLogin>> | null = null;
let pendingLoginName: string | null = null;

// Global config (persisted in memory, could save to file)
const globalConfig: GlobalConfig = {
  personality: SYSTEM_PROMPT,
  scheduleEnabled: false,
  scheduleStart: 9,
  scheduleEnd: 23,
  skipWeekends: false,
  responseDelayMin: 1500,
  responseDelayMax: 4000,
  maxRepliesPerHour: 30,
};

// Analytics (persisted to file)
let analytics: Analytics = loadAnalytics();

function loadAnalytics(): Analytics {
  try {
    if (existsSync(ANALYTICS_PATH)) {
      return JSON.parse(readFileSync(ANALYTICS_PATH, 'utf-8'));
    }
  } catch (e) {
    logger.warn('Failed to load analytics', { error: e });
  }
  return {
    hourlyData: initHourlyData(),
    totalReceived: 0,
    totalSent: 0,
    responseTimes: [],
    lastUpdated: new Date().toISOString(),
  };
}

function saveAnalytics(): void {
  try {
    const dir = resolve(process.cwd(), 'data');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(ANALYTICS_PATH, JSON.stringify(analytics, null, 2));
  } catch (e) {
    logger.error('Failed to save analytics', { error: e });
  }
}

function initHourlyData(): HourlyData[] {
  const data: HourlyData[] = [];
  const now = new Date();
  for (let i = 23; i >= 0; i--) {
    const hour = new Date(now.getTime() - i * 3600000);
    data.push({
      hour: hour.getHours().toString().padStart(2, '0') + ':00',
      received: 0,
      sent: 0,
    });
  }
  return data;
}

function updateHourlyData(type: 'received' | 'sent'): void {
  const hourKey = new Date().getHours().toString().padStart(2, '0') + ':00';
  const hourData = analytics.hourlyData.find((h) => h.hour === hourKey);
  if (hourData) {
    hourData[type]++;
  }
  if (type === 'received') {
    analytics.totalReceived++;
  } else {
    analytics.totalSent++;
  }
  analytics.lastUpdated = new Date().toISOString();
  saveAnalytics();
}

function recordResponseTime(ms: number): void {
  analytics.responseTimes.push(ms);
  if (analytics.responseTimes.length > 100) {
    analytics.responseTimes.shift();
  }
  saveAnalytics();
}

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
      updateHourlyData('received');
      break;
    case 'message_sent':
      updateHourlyData('sent');
      if (typeof msg.responseTime === 'number') {
        recordResponseTime(msg.responseTime);
      }
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
  });

  // Handle stdout (fallback for non-IPC)
  child.stdout?.on('data', (data) => {
    const output = data.toString();
    parseWorkerOutput(sessionId, output);
    // Log non-message output
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
// ANALYTICS ENDPOINTS
// =========================================

app.get('/api/analytics', (_req, res) => {
  const avgResponseTime = analytics.responseTimes.length > 0
    ? Math.round(analytics.responseTimes.reduce((a, b) => a + b, 0) / analytics.responseTimes.length)
    : 0;

  const replyRate = analytics.totalReceived > 0
    ? Math.round((analytics.totalSent / analytics.totalReceived) * 100)
    : 0;

  res.json({
    hourlyData: analytics.hourlyData,
    totalReceived: analytics.totalReceived,
    totalSent: analytics.totalSent,
    avgResponseTime,
    replyRate,
    activeBots: activeBots.size,
    responseTimes: analytics.responseTimes.slice(-20),
  });
});

app.post('/api/analytics/reset', (_req, res) => {
  analytics = {
    hourlyData: initHourlyData(),
    totalReceived: 0,
    totalSent: 0,
    responseTimes: [],
    lastUpdated: new Date().toISOString(),
  };
  saveAnalytics();
  res.json({ success: true });
});

// =========================================
// CONFIG ENDPOINTS
// =========================================

app.get('/api/config', (_req, res) => {
  res.json(globalConfig);
});

app.post('/api/config', (req, res) => {
  const updates = req.body;
  
  if (typeof updates.personality === 'string') {
    globalConfig.personality = updates.personality;
  }
  if (typeof updates.scheduleEnabled === 'boolean') {
    globalConfig.scheduleEnabled = updates.scheduleEnabled;
  }
  if (typeof updates.scheduleStart === 'number') {
    globalConfig.scheduleStart = updates.scheduleStart;
  }
  if (typeof updates.scheduleEnd === 'number') {
    globalConfig.scheduleEnd = updates.scheduleEnd;
  }
  if (typeof updates.skipWeekends === 'boolean') {
    globalConfig.skipWeekends = updates.skipWeekends;
  }
  if (typeof updates.responseDelayMin === 'number') {
    globalConfig.responseDelayMin = updates.responseDelayMin;
  }
  if (typeof updates.responseDelayMax === 'number') {
    globalConfig.responseDelayMax = updates.responseDelayMax;
  }
  if (typeof updates.maxRepliesPerHour === 'number') {
    globalConfig.maxRepliesPerHour = updates.maxRepliesPerHour;
  }

  // Broadcast config to all running bots
  for (const [, bot] of activeBots) {
    bot.process.send?.({ type: 'config', config: globalConfig });
  }

  logger.info('Config updated', globalConfig);
  res.json({ success: true, config: globalConfig });
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

  saveAnalytics();
  process.exit(0);
});

main();
