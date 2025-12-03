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
  status: 'stopped' | 'starting' | 'running' | 'paused' | 'stopping' | 'error';
  stats: SessionStats | null;
}

export interface LoginStatus {
  inProgress: boolean;
  name: string | null;
}

export interface HourlyData {
  hour: string;
  received: number;
  sent: number;
}

export interface Analytics {
  hourlyData: HourlyData[];
  totalReceived: number;
  totalSent: number;
  avgResponseTime: number;
  replyRate: number;
  activeBots: number;
  responseTimes: number[];
}

export interface GlobalConfig {
  personality: string;
  scheduleEnabled: boolean;
  scheduleStart: number;
  scheduleEnd: number;
  skipWeekends: boolean;
  responseDelayMin: number;
  responseDelayMax: number;
  maxRepliesPerHour: number;
}
