// Session management - discovers and manages session files with per-session config

import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'fs';
import { resolve, basename } from 'path';
import { logger } from './utils/logger.js';
import { SYSTEM_PROMPT } from './ai/prompts.js';

const SESSIONS_DIR = resolve(process.cwd(), 'data', 'sessions');

export interface SessionConfig {
  personality: string;
  responseDelayMin: number;
  responseDelayMax: number;
  maxRepliesPerHour: number;
  scheduleEnabled: boolean;
  scheduleStart: number;
  scheduleEnd: number;
  skipWeekends: boolean;
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
}

export const DEFAULT_CONFIG: SessionConfig = {
  personality: SYSTEM_PROMPT,
  responseDelayMin: 1500,
  responseDelayMax: 4000,
  maxRepliesPerHour: 30,
  scheduleEnabled: false,
  scheduleStart: 9,
  scheduleEnd: 23,
  skipWeekends: false,
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
      
      const config: SessionConfig = {
        ...DEFAULT_CONFIG,
        ...data._config,
      };
      
      sessions.push({
        id,
        name: meta.name,
        path,
        createdAt: meta.createdAt,
        lastUsed: meta.lastUsed,
        config,
      });
    } catch (e) {
      logger.warn('Failed to read session file', { file, error: e });
    }
  }
  
  return sessions.sort((a, b) => a.name.localeCompare(b.name));
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
