// Session management - discovers and manages session files with per-session config and analytics

import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'fs';
import { resolve, basename } from 'path';
import { logger } from './utils/logger.js';
import { SYSTEM_PROMPT } from './ai/prompts.js';

const SESSIONS_DIR = resolve(process.cwd(), 'data', 'sessions');

export interface SessionConfig {
  // AI Configuration
  personality: string;
  aiApiKey: string;          // Empty = use global from .env
  aiModel: string;
  aiTemperature: number;
  
  // Timing
  responseDelayMin: number;
  responseDelayMax: number;
  maxRepliesPerHour: number;
  
  // Schedule
  scheduleEnabled: boolean;
  scheduleStart: number;
  scheduleEnd: number;
  skipWeekends: boolean;
  
  // Filters
  ignoreList: string[];
  
  // Snap response (when someone sends a photo/video)
  snapResponse: string;
}

export interface DailyData {
  date: string;
  received: number;
  sent: number;
}

export interface SessionAnalytics {
  dailyData: DailyData[];
  totalReceived: number;
  totalSent: number;
  responseTimes: number[];
  lastUpdated: string;
}

export interface SessionMeta {
  name: string;
  createdAt: string;
  lastUsed: string | null;
}

export interface SessionInfo {
  id: string;
  name: string;
  path: string;
  createdAt: string;
  lastUsed: string | null;
  config: SessionConfig;
  analytics: SessionAnalytics;
}

export const DEFAULT_CONFIG: SessionConfig = {
  // AI - empty apiKey means use global from .env
  personality: SYSTEM_PROMPT,
  aiApiKey: '',
  aiModel: 'deepseek-chat',
  aiTemperature: 0.8,
  
  // Timing
  responseDelayMin: 1500,
  responseDelayMax: 4000,
  maxRepliesPerHour: 30,
  
  // Schedule
  scheduleEnabled: false,
  scheduleStart: 9,
  scheduleEnd: 23,
  skipWeekends: false,
  
  // Filters
  ignoreList: ['My AI', 'Team Snapchat'],
  
  // Snap response
  snapResponse: "i dont send pics here but you can see more on my twitter @yourhandle",
};

function initDailyData(): DailyData[] {
  const data: DailyData[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 86400000);
    data.push({
      date: date.toISOString().split('T')[0],
      received: 0,
      sent: 0,
    });
  }
  return data;
}

export const DEFAULT_ANALYTICS: SessionAnalytics = {
  dailyData: initDailyData(),
  totalReceived: 0,
  totalSent: 0,
  responseTimes: [],
  lastUpdated: new Date().toISOString(),
};

// Ensure sessions directory exists
export function ensureSessionsDir(): void {
  if (!existsSync(SESSIONS_DIR)) {
    mkdirSync(SESSIONS_DIR, { recursive: true });
    logger.info('Created sessions directory', { path: SESSIONS_DIR });
  }
}

// Get all available sessions
export function getSessions(): SessionInfo[] {
  ensureSessionsDir();
  
  const sessions: SessionInfo[] = [];
  const files = readdirSync(SESSIONS_DIR);
  
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    
    const id = basename(file, '.json');
    const path = resolve(SESSIONS_DIR, file);
    
    try {
      const content = readFileSync(path, 'utf-8');
      const data = JSON.parse(content);
      
      const meta: SessionMeta = data._meta || {
        name: id,
        createdAt: new Date().toISOString(),
        lastUsed: null,
      };
      
      // Skip if name is missing
      const name = meta.name || id;
      if (!name) {
        logger.warn('Skipping session with no name', { file });
        continue;
      }
      
      const config: SessionConfig = {
        ...DEFAULT_CONFIG,
        ...data._config,
      };
      
      const analytics: SessionAnalytics = {
        ...DEFAULT_ANALYTICS,
        dailyData: initDailyData(),
        ...data._analytics,
      };
      
      sessions.push({
        id,
        name,
        path,
        createdAt: meta.createdAt || new Date().toISOString(),
        lastUsed: meta.lastUsed || null,
        config,
        analytics,
      });
    } catch (e) {
      logger.warn('Failed to read session file', { file, error: e });
    }
  }
  
  return sessions.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

// Get session by ID
export function getSession(id: string): SessionInfo | null {
  const sessions = getSessions();
  return sessions.find((s) => s.id === id) || null;
}

// Get session file path
export function getSessionPath(id: string): string {
  return resolve(SESSIONS_DIR, `${id}.json`);
}

// Check if session exists
export function sessionExists(id: string): boolean {
  return existsSync(getSessionPath(id));
}

// Update session metadata
export function updateSessionMeta(id: string, updates: Partial<SessionMeta>): void {
  const path = getSessionPath(id);
  if (!existsSync(path)) return;
  
  try {
    const content = readFileSync(path, 'utf-8');
    const data = JSON.parse(content);
    
    data._meta = {
      ...data._meta,
      ...updates,
    };
    
    writeFileSync(path, JSON.stringify(data, null, 2));
  } catch (e) {
    logger.error('Failed to update session meta', { id, error: e });
  }
}

// Update session config
export function updateSessionConfig(id: string, updates: Partial<SessionConfig>): SessionConfig | null {
  const path = getSessionPath(id);
  if (!existsSync(path)) return null;
  
  try {
    const content = readFileSync(path, 'utf-8');
    const data = JSON.parse(content);
    
    const currentConfig: SessionConfig = {
      ...DEFAULT_CONFIG,
      ...data._config,
    };
    
    const newConfig: SessionConfig = {
      ...currentConfig,
      ...updates,
    };
    
    data._config = newConfig;
    
    writeFileSync(path, JSON.stringify(data, null, 2));
    logger.info('Session config updated', { id });
    
    return newConfig;
  } catch (e) {
    logger.error('Failed to update session config', { id, error: e });
    return null;
  }
}

// Get session config
export function getSessionConfig(id: string): SessionConfig | null {
  const session = getSession(id);
  return session?.config || null;
}

// Get session analytics
export function getSessionAnalytics(id: string): SessionAnalytics | null {
  const session = getSession(id);
  return session?.analytics || null;
}

// Update session analytics
export function updateSessionAnalytics(
  id: string,
  type: 'received' | 'sent',
  responseTime?: number
): void {
  const path = getSessionPath(id);
  if (!existsSync(path)) return;
  
  try {
    const content = readFileSync(path, 'utf-8');
    const data = JSON.parse(content);
    
    // Initialize analytics if missing
    if (!data._analytics) {
      data._analytics = { ...DEFAULT_ANALYTICS, dailyData: initDailyData() };
    }
    
    const analytics = data._analytics as SessionAnalytics;
    const today = new Date().toISOString().split('T')[0];
    
    // Find or create today's entry
    let dayData = analytics.dailyData.find((d) => d.date === today);
    if (!dayData) {
      dayData = { date: today, received: 0, sent: 0 };
      analytics.dailyData.push(dayData);
      // Keep only last 7 days
      if (analytics.dailyData.length > 7) {
        analytics.dailyData.shift();
      }
    }
    
    // Update counts
    if (type === 'received') {
      dayData.received++;
      analytics.totalReceived++;
    } else {
      dayData.sent++;
      analytics.totalSent++;
    }
    
    // Record response time
    if (responseTime !== undefined) {
      analytics.responseTimes.push(responseTime);
      if (analytics.responseTimes.length > 100) {
        analytics.responseTimes.shift();
      }
    }
    
    analytics.lastUpdated = new Date().toISOString();
    data._analytics = analytics;
    
    writeFileSync(path, JSON.stringify(data, null, 2));
  } catch (e) {
    logger.error('Failed to update session analytics', { id, error: e });
  }
}

// Reset session analytics
export function resetSessionAnalytics(id: string): void {
  const path = getSessionPath(id);
  if (!existsSync(path)) return;
  
  try {
    const content = readFileSync(path, 'utf-8');
    const data = JSON.parse(content);
    
    data._analytics = {
      ...DEFAULT_ANALYTICS,
      dailyData: initDailyData(),
    };
    
    writeFileSync(path, JSON.stringify(data, null, 2));
    logger.info('Session analytics reset', { id });
  } catch (e) {
    logger.error('Failed to reset session analytics', { id, error: e });
  }
}

// Create new session ID from name
export function createSessionId(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  
  let id = base || 'session';
  let counter = 1;
  while (sessionExists(id)) {
    id = `${base}-${counter}`;
    counter++;
  }
  
  return id;
}

// Delete session
export function deleteSession(id: string): boolean {
  const path = getSessionPath(id);
  if (!existsSync(path)) return false;
  
  try {
    unlinkSync(path);
    logger.info('Deleted session', { id });
    return true;
  } catch (e) {
    logger.error('Failed to delete session', { id, error: e });
    return false;
  }
}
