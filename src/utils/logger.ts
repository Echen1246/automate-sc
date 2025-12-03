import { config } from '../config/index.js';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

function formatTime(): string {
  return new Date().toISOString();
}

function formatMessage(level: LogLevel, message: string, data?: unknown): string {
  const base = `[${formatTime()}] [${level.toUpperCase()}] ${message}`;
  if (data !== undefined) {
    return `${base} ${JSON.stringify(data)}`;
  }
  return base;
}

export const logger = {
  info(message: string, data?: unknown): void {
    console.log(formatMessage('info', message, data));
  },

  warn(message: string, data?: unknown): void {
    console.warn(formatMessage('warn', message, data));
  },

  error(message: string, data?: unknown): void {
    console.error(formatMessage('error', message, data));
  },

  debug(message: string, data?: unknown): void {
    if (config.debug) {
      console.log(formatMessage('debug', message, data));
    }
  },
};

