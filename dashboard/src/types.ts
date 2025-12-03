export interface SessionConfig {
  // AI Configuration
  personality: string;
  aiApiKey: string;
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
  
  // Snap response
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
  avgResponseTime: number;
  replyRate: number;
  responseTimes: number[];
}

export interface SessionStats {
  messagesReceived: number;
  messagesSent: number;
  conversationsHandled: number;
  avgResponseTime: number;
  startedAt: string | null;
  lastActivity: string | null;
}

export interface Session {
  id: string;
  name: string;
  path: string;
  createdAt: string;
  lastUsed: string | null;
  config: SessionConfig;
  analytics: SessionAnalytics;
  status: 'stopped' | 'starting' | 'running' | 'paused' | 'stopping' | 'error';
  stats: SessionStats | null;
}

export interface LoginStatus {
  inProgress: boolean;
  name: string | null;
}

export interface GlobalStats {
  activeBots: number;
  totalSessions: number;
  totalReceived: number;
  totalSent: number;
}
