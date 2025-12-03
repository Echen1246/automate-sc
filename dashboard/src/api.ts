import type { BotState, Schedule, FrequencySettings } from './types';

const API_BASE = '/api';

export async function fetchState(): Promise<BotState> {
  const res = await fetch(`${API_BASE}/state`);
  return res.json();
}

export async function startBot(): Promise<BotState> {
  const res = await fetch(`${API_BASE}/start`, { method: 'POST' });
  return res.json();
}

export async function stopBot(): Promise<BotState> {
  const res = await fetch(`${API_BASE}/stop`, { method: 'POST' });
  return res.json();
}

export async function pauseBot(): Promise<BotState> {
  const res = await fetch(`${API_BASE}/pause`, { method: 'POST' });
  return res.json();
}

export async function resumeBot(): Promise<BotState> {
  const res = await fetch(`${API_BASE}/resume`, { method: 'POST' });
  return res.json();
}

export async function updateSchedule(schedule: Partial<Schedule>): Promise<BotState> {
  const res = await fetch(`${API_BASE}/schedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(schedule),
  });
  return res.json();
}

export async function updateFrequency(frequency: Partial<FrequencySettings>): Promise<BotState> {
  const res = await fetch(`${API_BASE}/frequency`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(frequency),
  });
  return res.json();
}

export async function updatePersonality(personality: string): Promise<BotState> {
  const res = await fetch(`${API_BASE}/personality`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ personality }),
  });
  return res.json();
}

