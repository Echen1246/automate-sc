import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { CommandCard } from './components/CommandCard';
import { KPICards } from './components/KPICards';
import { TrafficChart, ResponseTimeChart } from './components/Charts';
import { ConfigPanel } from './components/ConfigPanel';
import * as api from './api';
import type { Session, SessionConfig, SessionAnalytics, LoginStatus } from './types';

function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loginStatus, setLoginStatus] = useState<LoginStatus>({ inProgress: false, name: null });
  const [sessionAnalytics, setSessionAnalytics] = useState<SessionAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'config'>('overview');

  const activeSession = sessions.find((s) => s.id === activeSessionId) || null;

  // Fetch sessions and login status
  const refreshSessions = async () => {
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

  // Fetch analytics for active session
  const refreshAnalytics = async () => {
    if (!activeSessionId) {
      setSessionAnalytics(null);
      return;
    }
    try {
      const analytics = await api.getSessionAnalytics(activeSessionId);
      setSessionAnalytics(analytics);
    } catch {
      setSessionAnalytics(null);
    }
  };

  useEffect(() => {
    refreshSessions();
    const interval = setInterval(refreshSessions, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    refreshAnalytics();
    const interval = setInterval(refreshAnalytics, 2000);
    return () => clearInterval(interval);
  }, [activeSessionId]);

  const handleNewSession = async (name: string) => {
    try {
      await api.startLogin(name);
      refreshSessions();
    } catch {
      setError('Failed to start login');
    }
  };

  const handleCompleteLogin = async () => {
    try {
      const result = await api.completeLogin();
      setActiveSessionId(result.sessionId);
      refreshSessions();
    } catch {
      setError('Failed to save session');
    }
  };

  const handleCancelLogin = async () => {
    try {
      await api.cancelLogin();
      refreshSessions();
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
      refreshSessions();
    } catch {
      setError('Failed to delete session');
    }
  };

  const handleStart = async () => {
    if (!activeSessionId) return;
    try {
      await api.startSession(activeSessionId);
      refreshSessions();
    } catch {
      setError('Failed to start bot');
    }
  };

  const handlePause = async () => {
    if (!activeSessionId) return;
    try {
      await api.pauseSession(activeSessionId);
      refreshSessions();
    } catch {
      setError('Failed to pause bot');
    }
  };

  const handleResume = async () => {
    if (!activeSessionId) return;
    try {
      await api.resumeSession(activeSessionId);
      refreshSessions();
    } catch {
      setError('Failed to resume bot');
    }
  };

  const handleStop = async () => {
    if (!activeSessionId) return;
    try {
      await api.stopSession(activeSessionId);
      refreshSessions();
    } catch {
      setError('Failed to stop bot');
    }
  };

  const handleSaveConfig = async (updates: Partial<SessionConfig>): Promise<void> => {
    if (!activeSessionId) return;
    try {
      await api.updateSessionConfig(activeSessionId, updates);
      await refreshSessions();
    } catch {
      setError('Failed to save configuration');
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

      <main className="flex-1 overflow-auto">
        {/* Tab Navigation */}
        <div className="sticky top-0 z-10 bg-slate-950 border-b border-slate-800 px-6 py-3">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'overview'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('config')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'config'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Configuration
            </button>
          </div>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-900/50 border border-red-800 rounded-lg text-red-200 text-sm">
              {error}
            </div>
          )}

          {activeTab === 'overview' && (
            <div className="max-w-7xl mx-auto space-y-6">
              {/* KPI Cards */}
              <KPICards
                analytics={sessionAnalytics}
                sessionName={activeSession?.name || null}
              />

              {/* Session Control + Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                  <CommandCard
                    session={activeSession}
                    onStart={handleStart}
                    onPause={handlePause}
                    onResume={handleResume}
                    onStop={handleStop}
                  />
                </div>
                <div className="lg:col-span-2">
                  <TrafficChart analytics={sessionAnalytics} />
                </div>
              </div>

              {/* Response Time Chart */}
              <ResponseTimeChart analytics={sessionAnalytics} />
            </div>
          )}

          {activeTab === 'config' && (
            <div className="max-w-2xl mx-auto">
              <ConfigPanel
                config={activeSession?.config || null}
                sessionId={activeSessionId}
                sessionName={activeSession?.name || null}
                onSave={handleSaveConfig}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
