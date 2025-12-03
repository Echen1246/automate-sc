import type { Session, LoginStatus } from './types';

const API_BASE = '/api';

// Sessions
export async function getSessions(): Promise<Session[]> {
  const res = await fetch(`${API_BASE}/sessions`);
  return res.json();
}

export async function getSession(id: string): Promise<Session> {
  const res = await fetch(`${API_BASE}/sessions/${id}`);
  return res.json();
}

export async function startSession(id: string): Promise<void> {
  await fetch(`${API_BASE}/sessions/${id}/start`, { method: 'POST' });
}

export async function stopSession(id: string): Promise<void> {
  await fetch(`${API_BASE}/sessions/${id}/stop`, { method: 'POST' });
}

export async function pauseSession(id: string): Promise<void> {
  await fetch(`${API_BASE}/sessions/${id}/pause`, { method: 'POST' });
}

export async function resumeSession(id: string): Promise<void> {
  await fetch(`${API_BASE}/sessions/${id}/resume`, { method: 'POST' });
}

export async function deleteSession(id: string): Promise<void> {
  await fetch(`${API_BASE}/sessions/${id}`, { method: 'DELETE' });
}

// Login
export async function startLogin(name: string): Promise<void> {
  await fetch(`${API_BASE}/login/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

export async function completeLogin(): Promise<{ sessionId: string }> {
  const res = await fetch(`${API_BASE}/login/complete`, { method: 'POST' });
  return res.json();
}

export async function cancelLogin(): Promise<void> {
  await fetch(`${API_BASE}/login/cancel`, { method: 'POST' });
}

export async function getLoginStatus(): Promise<LoginStatus> {
  const res = await fetch(`${API_BASE}/login/status`);
  return res.json();
}
