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
}

export interface BotSession {
  id: string;
  name: string;
  status: 'running' | 'paused' | 'stopped';
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

