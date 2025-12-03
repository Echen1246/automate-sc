// Shared state between bot and dashboard API

import { SYSTEM_PROMPT } from './ai/prompts.js';

export interface Schedule {
  enabled: boolean;
  startHour: number;
  endHour: number;
  skipWeekends: boolean;
}

export interface FrequencySettings {
  pollIntervalMin: number;
  pollIntervalMax: number;
  responseDelayMin: number;
  responseDelayMax: number;
  maxRepliesPerHour: number;
}

export interface Stats {
  messagesReceived: number;
  messagesSent: number;
  startedAt: string | null;
  lastActivity: string | null;
}

export interface Analytics {
  hourlyMessages: Array<{ hour: string; sent: number; received: number }>;
  responseTimes: number[];
  conversationLengths: number[];
  repliesThisHour: number;
  lastHourReset: number;
}

export interface BotState {
  isRunning: boolean;
  isPaused: boolean;
  schedule: Schedule;
  frequency: FrequencySettings;
  personality: string;
  stats: Stats;
  analytics: Analytics;
}

// Initialize hourly data for last 24 hours
function initHourlyData(): Array<{ hour: string; sent: number; received: number }> {
  const data = [];
  const now = new Date();
  for (let i = 23; i >= 0; i--) {
    const hour = new Date(now.getTime() - i * 3600000);
    data.push({
      hour: hour.getHours().toString().padStart(2, '0') + ':00',
      sent: 0,
      received: 0,
    });
  }
  return data;
}

// Global state object
export const state: BotState = {
  isRunning: false,
  isPaused: false,
  schedule: {
    enabled: false,
    startHour: 9,
    endHour: 23,
    skipWeekends: false,
  },
  frequency: {
    pollIntervalMin: 2000,
    pollIntervalMax: 5000,
    responseDelayMin: 1500,
    responseDelayMax: 4000,
    maxRepliesPerHour: 30,
  },
  personality: SYSTEM_PROMPT,
  stats: {
    messagesReceived: 0,
    messagesSent: 0,
    startedAt: null,
    lastActivity: null,
  },
  analytics: {
    hourlyMessages: initHourlyData(),
    responseTimes: [],
    conversationLengths: [],
    repliesThisHour: 0,
    lastHourReset: Date.now(),
  },
};

// Helper functions
export function isWithinSchedule(): boolean {
  if (!state.schedule.enabled) return true;

  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();

  // Check weekend skip
  if (state.schedule.skipWeekends && (day === 0 || day === 6)) {
    return false;
  }

  if (state.schedule.startHour <= state.schedule.endHour) {
    return hour >= state.schedule.startHour && hour < state.schedule.endHour;
  } else {
    return hour >= state.schedule.startHour || hour < state.schedule.endHour;
  }
}

export function canReplyThisHour(): boolean {
  // Reset hourly counter if new hour
  const now = Date.now();
  if (now - state.analytics.lastHourReset > 3600000) {
    state.analytics.repliesThisHour = 0;
    state.analytics.lastHourReset = now;
  }

  return state.analytics.repliesThisHour < state.frequency.maxRepliesPerHour;
}

export function shouldProcess(): boolean {
  return state.isRunning && !state.isPaused && isWithinSchedule() && canReplyThisHour();
}

export function updateStats(type: 'received' | 'sent'): void {
  const now = new Date();
  const hourKey = now.getHours().toString().padStart(2, '0') + ':00';

  if (type === 'received') {
    state.stats.messagesReceived++;
    // Update hourly data
    const hourData = state.analytics.hourlyMessages.find((h) => h.hour === hourKey);
    if (hourData) hourData.received++;
  } else {
    state.stats.messagesSent++;
    state.analytics.repliesThisHour++;
    const hourData = state.analytics.hourlyMessages.find((h) => h.hour === hourKey);
    if (hourData) hourData.sent++;
  }

  state.stats.lastActivity = now.toISOString();
}

export function recordResponseTime(ms: number): void {
  state.analytics.responseTimes.push(ms);
  // Keep last 100 response times
  if (state.analytics.responseTimes.length > 100) {
    state.analytics.responseTimes.shift();
  }
}

export function recordConversationLength(length: number): void {
  state.analytics.conversationLengths.push(length);
  // Keep last 50 conversation lengths
  if (state.analytics.conversationLengths.length > 50) {
    state.analytics.conversationLengths.shift();
  }
}

export function resetStats(): void {
  state.stats.messagesReceived = 0;
  state.stats.messagesSent = 0;
  state.stats.startedAt = new Date().toISOString();
  state.stats.lastActivity = null;
  state.analytics.hourlyMessages = initHourlyData();
  state.analytics.responseTimes = [];
  state.analytics.conversationLengths = [];
  state.analytics.repliesThisHour = 0;
  state.analytics.lastHourReset = Date.now();
}
