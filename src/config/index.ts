import 'dotenv/config';

export interface Config {
  // Polling intervals (ms)
  pollIntervalMin: number;
  pollIntervalMax: number;

  // Human-like delays (ms)
  responseDelayMin: number;
  responseDelayMax: number;
  typingDelayMin: number;
  typingDelayMax: number;

  // AI
  deepseekApiKey: string | undefined;
  deepseekModel: string;

  // Behavior
  autoReply: boolean;
  debug: boolean;

  // Filters
  ignoreList: string[];
}

export const config: Config = {
  pollIntervalMin: 2000,
  pollIntervalMax: 5000,

  responseDelayMin: 1500,
  responseDelayMax: 4000,
  typingDelayMin: 30,
  typingDelayMax: 80,

  deepseekApiKey: process.env.DEEPSEEK_API_KEY,
  deepseekModel: 'deepseek-chat',

  autoReply: true,
  debug: process.env.DEBUG === 'true',

  ignoreList: ['My AI', 'Team Snapchat'],
};

