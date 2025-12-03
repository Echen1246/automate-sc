import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { CommandCard } from './components/CommandCard';
import { KPICards } from './components/KPICards';
import { TrafficChart, ResponseTimeChart } from './components/Charts';
import { ConfigPanel } from './components/ConfigPanel';
import * as api from './api';
import type { Session, LoginStatus, Analytics, GlobalConfig } from './types';

const DEFAULT_ANALYTICS: Analytics = {
  hourlyData: [],
  totalReceived: 0,
  totalSent: 0,
  avgResponseTime: 0,
  replyRate: 0,
  activeBots: 0,
  responseTimes: [],
};

const DEFAULT_CONFIG: GlobalConfig = {
  personality: '',
  scheduleEnabled: false,
  scheduleStart: 9,
  scheduleEnd: 23,
  skipWeekends: false,
  responseDelayMin: 1500,
  responseDelayMax: 4000,
  maxRepliesPerHour: 30,
};

function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loginStatus, setLoginStatus] = useState<LoginStatus>({ inProgress: false, name: null });
  const [analytics, setAnalytics] = useState<Analytics>(DEFAULT_ANALYTICS);
  const [config, setConfig] = useState<GlobalConfig>(DEFAULT_CONFIG);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'config'>('overview');

  const activeSession = sessions.find((s) => s.id === activeSessionId) || null;

  const refresh = async () => {
    try {
      const [sessionsData, loginData, analyticsData, configData] = await Promise.all([
        api.getSessions(),
        api.getLoginStatus(),
        api.getAnalytics(),
        api.getConfig(),
      ]);
      setSessions(sessionsData);
      setLoginStatus(loginData);
      setAnalytics(analyticsData);
      setConfig(configData);
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

  const handleSaveConfig = async (updates: Partial<GlobalConfig>) => {
    try {
      await api.updateConfig(updates);
      refresh();
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
              <KPICards analytics={analytics} />

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
                  <TrafficChart analytics={analytics} />
                </div>
              </div>

              {/* Response Time Chart */}
              <ResponseTimeChart analytics={analytics} />

              {/* Session Table */}
              {sessions.length > 0 && (
                <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-800">
                    <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                      All Sessions
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-800">
                          <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                            Name
                          </th>
                          <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                            Status
                          </th>
                          <th className="px-5 py-3 text-right text-xs font-medium text-slate-500 uppercase">
                            Received
                          </th>
                          <th className="px-5 py-3 text-right text-xs font-medium text-slate-500 uppercase">
                            Sent
                          </th>
                          <th className="px-5 py-3 text-right text-xs font-medium text-slate-500 uppercase">
                            Last Active
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessions.map((session) => (
                          <tr
                            key={session.id}
                            onClick={() => setActiveSessionId(session.id)}
                            className={`border-b border-slate-800/50 cursor-pointer transition-colors ${
                              activeSessionId === session.id
                                ? 'bg-slate-800/50'
                                : 'hover:bg-slate-800/25'
                            }`}
                          >
                            <td className="px-5 py-3 text-sm text-white font-medium">
                              {session.name}
                            </td>
                            <td className="px-5 py-3">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full ${
                                  session.status === 'running'
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : session.status === 'paused'
                                    ? 'bg-amber-500/20 text-amber-400'
                                    : session.status === 'error'
                                    ? 'bg-red-500/20 text-red-400'
                                    : 'bg-slate-500/20 text-slate-400'
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    session.status === 'running'
                                      ? 'bg-emerald-400'
                                      : session.status === 'paused'
                                      ? 'bg-amber-400'
                                      : session.status === 'error'
                                      ? 'bg-red-400'
                                      : 'bg-slate-400'
                                  }`}
                                />
                                {session.status}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-sm text-slate-300 text-right">
                              {session.stats?.messagesReceived ?? '-'}
                            </td>
                            <td className="px-5 py-3 text-sm text-slate-300 text-right">
                              {session.stats?.messagesSent ?? '-'}
                            </td>
                            <td className="px-5 py-3 text-sm text-slate-500 text-right">
                              {session.stats?.lastActivity
                                ? new Date(session.stats.lastActivity).toLocaleTimeString()
                                : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'config' && (
            <div className="max-w-2xl mx-auto">
              <ConfigPanel config={config} onSave={handleSaveConfig} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
