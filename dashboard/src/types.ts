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
  status: 'stopped' | 'starting' | 'running' | 'paused' | 'stopping' | 'error';
  stats: SessionStats | null;
}

export interface LoginStatus {
  inProgress: boolean;
  name: string | null;
}

export interface DailyData {
  date: string;
  received: number;
  sent: number;
}

export interface Analytics {
  dailyData: DailyData[];
  totalReceived: number;
  totalSent: number;
  avgResponseTime: number;
  replyRate: number;
  activeBots: number;
  responseTimes: number[];
}
