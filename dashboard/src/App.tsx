import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { CommandCard } from './components/CommandCard';
import * as api from './api';
import type { Session, LoginStatus } from './types';

function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loginStatus, setLoginStatus] = useState<LoginStatus>({ inProgress: false, name: null });
  const [error, setError] = useState<string | null>(null);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || null;

  const refresh = async () => {
    try {
      const [sessionsData, loginData] = await Promise.all([
        api.getSessions(),
        api.getLoginStatus(),
      ]);
      setSessions(sessionsData);
      setLoginStatus(loginData);
      setError(null);
    } catch {
      setError('Failed to connect to server');
    }
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleNewSession = async (name: string) => {
    try {
      await api.startLogin(name);
      refresh();
    } catch {
      setError('Failed to start login');
    }
  };

  const handleCompleteLogin = async () => {
    try {
      const result = await api.completeLogin();
      setActiveSessionId(result.sessionId);
      refresh();
    } catch {
      setError('Failed to save session');
    }
  };

  const handleCancelLogin = async () => {
    try {
      await api.cancelLogin();
      refresh();
    } catch {
      setError('Failed to cancel login');
    }
  };

  const handleDeleteSession = async (id: string) => {
    try {
      await api.deleteSession(id);
      if (activeSessionId === id) {
        setActiveSessionId(null);
      }
      refresh();
    } catch {
      setError('Failed to delete session');
    }
  };

  const handleStart = async () => {
    if (!activeSessionId) return;
    try {
      await api.startSession(activeSessionId);
      refresh();
    } catch {
      setError('Failed to start bot');
    }
  };

  const handlePause = async () => {
    if (!activeSessionId) return;
    try {
      await api.pauseSession(activeSessionId);
      refresh();
    } catch {
      setError('Failed to pause bot');
    }
  };

  const handleResume = async () => {
    if (!activeSessionId) return;
    try {
      await api.resumeSession(activeSessionId);
      refresh();
    } catch {
      setError('Failed to resume bot');
    }
  };

  const handleStop = async () => {
    if (!activeSessionId) return;
    try {
      await api.stopSession(activeSessionId);
      refresh();
    } catch {
      setError('Failed to stop bot');
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        sessions={sessions}
        activeSession={activeSessionId}
        loginStatus={loginStatus}
        onSelectSession={setActiveSessionId}
        onNewSession={handleNewSession}
        onCompleteLogin={handleCompleteLogin}
        onCancelLogin={handleCancelLogin}
        onDeleteSession={handleDeleteSession}
      />

      <main className="flex-1 overflow-auto p-6">
        {error && (
          <div className="mb-4 p-4 bg-red-900/50 border border-red-800 rounded-lg text-red-200 text-sm">
            {error}
          </div>
        )}

        <div className="max-w-4xl mx-auto">
          <CommandCard
            session={activeSession}
            onStart={handleStart}
            onPause={handlePause}
            onResume={handleResume}
            onStop={handleStop}
          />

          {!activeSession && sessions.length === 0 && (
            <div className="mt-8 text-center">
              <h2 className="text-xl font-semibold text-white mb-2">Welcome to Command Center</h2>
              <p className="text-slate-400 mb-4">
                Get started by adding your first Snapchat session
              </p>
              <p className="text-sm text-slate-500">
                Click the + button in the sidebar to add an account
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
