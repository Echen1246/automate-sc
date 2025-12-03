// Shared state between bot and dashboard API

import { SYSTEM_PROMPT } from './ai/prompts.js';

export interface Schedule {
  enabled: boolean;
  startHour: number;  // 0-23 local time
  endHour: number;    // 0-23 local time
}

export interface FrequencySettings {
  pollIntervalMin: number;
  pollIntervalMax: number;
  responseDelayMin: number;
  responseDelayMax: number;
}

export interface Stats {
  messagesReceived: number;
  messagesSent: number;
  startedAt: string | null;
  lastActivity: string | null;
}

export interface BotState {
  isRunning: boolean;
  isPaused: boolean;
  schedule: Schedule;
  frequency: FrequencySettings;
  personality: string;
  stats: Stats;
}

// Global state object
export const state: BotState = {
  isRunning: false,
  isPaused: false,
  schedule: {
    enabled: false,
    startHour: 9,
    endHour: 23,
  },
  frequency: {
    pollIntervalMin: 2000,
    pollIntervalMax: 5000,
    responseDelayMin: 1500,
    responseDelayMax: 4000,
  },
  personality: SYSTEM_PROMPT,
  stats: {
    messagesReceived: 0,
    messagesSent: 0,
    startedAt: null,
    lastActivity: null,
  },
};

// Helper functions
export function isWithinSchedule(): boolean {
  if (!state.schedule.enabled) return true;
  
  const now = new Date();
  const hour = now.getHours();
  
  if (state.schedule.startHour <= state.schedule.endHour) {
    // Normal range (e.g., 9-23)
    return hour >= state.schedule.startHour && hour < state.schedule.endHour;
  } else {
    // Overnight range (e.g., 22-6)
    return hour >= state.schedule.startHour || hour < state.schedule.endHour;
  }
}

export function shouldProcess(): boolean {
  return state.isRunning && !state.isPaused && isWithinSchedule();
}

export function updateStats(type: 'received' | 'sent'): void {
  if (type === 'received') {
    state.stats.messagesReceived++;
  } else {
    state.stats.messagesSent++;
  }
  state.stats.lastActivity = new Date().toISOString();
}

export function resetStats(): void {
  state.stats.messagesReceived = 0;
  state.stats.messagesSent = 0;
  state.stats.startedAt = new Date().toISOString();
  state.stats.lastActivity = null;
}

