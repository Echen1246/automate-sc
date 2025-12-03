export interface Session {
  id: string;
  name: string;
  path: string;
  createdAt: string;
  lastUsed: string | null;
  status: 'stopped' | 'starting' | 'running' | 'paused' | 'stopping' | 'error';
  stats: SessionStats | null;
}

export interface SessionStats {
  messagesReceived: number;
  messagesSent: number;
  startedAt: string | null;
  lastActivity: string | null;
}

export interface LoginStatus {
  inProgress: boolean;
  name: string | null;
}
