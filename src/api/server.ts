import express from 'express';
import cors from 'cors';
import { resolve } from 'path';
import { state, resetStats } from '../state.js';
import { logger } from '../utils/logger.js';

const app = express();
const PORT = 3847;

app.use(cors());
app.use(express.json());

// Serve static dashboard files (built React app)
app.use(express.static(resolve(process.cwd(), 'dashboard', 'dist')));

// Get current state
app.get('/api/state', (_req, res) => {
  res.json(state);
});

// Start bot
app.post('/api/start', (_req, res) => {
  state.isRunning = true;
  state.isPaused = false;
  if (!state.stats.startedAt) {
    resetStats();
  }
  logger.info('Bot started via API');
  res.json({ success: true, state });
});

// Stop bot
app.post('/api/stop', (_req, res) => {
  state.isRunning = false;
  logger.info('Bot stopped via API');
  res.json({ success: true, state });
});

// Pause bot
app.post('/api/pause', (_req, res) => {
  state.isPaused = true;
  logger.info('Bot paused via API');
  res.json({ success: true, state });
});

// Resume bot
app.post('/api/resume', (_req, res) => {
  state.isPaused = false;
  logger.info('Bot resumed via API');
  res.json({ success: true, state });
});

// Update schedule
app.post('/api/schedule', (req, res) => {
  const { enabled, startHour, endHour, skipWeekends } = req.body;

  if (typeof enabled === 'boolean') state.schedule.enabled = enabled;
  if (typeof startHour === 'number') state.schedule.startHour = Math.min(23, Math.max(0, startHour));
  if (typeof endHour === 'number') state.schedule.endHour = Math.min(23, Math.max(0, endHour));
  if (typeof skipWeekends === 'boolean') state.schedule.skipWeekends = skipWeekends;

  logger.info('Schedule updated via API', state.schedule);
  res.json({ success: true, state });
});

// Update frequency
app.post('/api/frequency', (req, res) => {
  const { pollIntervalMin, pollIntervalMax, responseDelayMin, responseDelayMax, maxRepliesPerHour } = req.body;

  if (typeof pollIntervalMin === 'number') state.frequency.pollIntervalMin = pollIntervalMin;
  if (typeof pollIntervalMax === 'number') state.frequency.pollIntervalMax = pollIntervalMax;
  if (typeof responseDelayMin === 'number') state.frequency.responseDelayMin = responseDelayMin;
  if (typeof responseDelayMax === 'number') state.frequency.responseDelayMax = responseDelayMax;
  if (typeof maxRepliesPerHour === 'number') state.frequency.maxRepliesPerHour = maxRepliesPerHour;

  logger.info('Frequency updated via API', state.frequency);
  res.json({ success: true, state });
});

// Update personality
app.post('/api/personality', (req, res) => {
  const { personality } = req.body;

  if (typeof personality === 'string' && personality.length > 0) {
    state.personality = personality;
    logger.info('Personality updated via API');
  }

  res.json({ success: true, state });
});

// Reset stats
app.post('/api/stats/reset', (_req, res) => {
  resetStats();
  logger.info('Stats reset via API');
  res.json({ success: true, state });
});

// Fallback to index.html for SPA routing
app.get('*', (_req, res) => {
  res.sendFile(resolve(process.cwd(), 'dashboard', 'dist', 'index.html'));
});

export function startServer(): void {
  app.listen(PORT, () => {
    logger.info(`Dashboard server running at http://localhost:${PORT}`);
  });
}
