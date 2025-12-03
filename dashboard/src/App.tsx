import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { CommandCard } from './components/CommandCard';
import { ConfigurationCard } from './components/ConfigurationCard';
import { PersonalityCard } from './components/PersonalityCard';
import { AnalyticsSection } from './components/AnalyticsSection';
import * as api from './api';
import type { BotState, BotSession, Schedule, FrequencySettings } from './types';

const DEFAULT_STATE: BotState = {
  isRunning: false,
  isPaused: false,
  schedule: { enabled: false, startHour: 9, endHour: 23, skipWeekends: false },
  frequency: {
    pollIntervalMin: 2000,
    pollIntervalMax: 5000,
    responseDelayMin: 1500,
    responseDelayMax: 4000,
    maxRepliesPerHour: 30,
  },
  personality: '',
  stats: { messagesReceived: 0, messagesSent: 0, startedAt: null, lastActivity: null },
  analytics: {
    hourlyMessages: [],
    responseTimes: [],
    conversationLengths: [],
    repliesThisHour: 0,
  },
};

const MOCK_SESSIONS: BotSession[] = [
  { id: '1', name: 'Account 1', status: 'running' },
  { id: '2', name: 'Account 2', status: 'stopped' },
];

function App() {
  const [state, setState] = useState<BotState>(DEFAULT_STATE);
  const [sessions, setSessions] = useState<BotSession[]>(MOCK_SESSIONS);
  const [activeSession, setActiveSession] = useState('1');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchState = async () => {
    try {
      const data = await api.fetchState();
      setState(data);
      setError(null);

      // Update session status
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSession
            ? {
                ...s,
                status: !data.isRunning ? 'stopped' : data.isPaused ? 'paused' : 'running',
              }
            : s
        )
      );
    } catch {
      setError('Failed to connect to bot server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 2000);
    return () => clearInterval(interval);
  }, [activeSession]);

  const handleStart = async () => {
    try {
      if (state.isPaused) {
        await api.resumeBot();
      } else {
        await api.startBot();
      }
      fetchState();
    } catch {
      setError('Failed to start bot');
    }
  };

  const handlePause = async () => {
    try {
      if (state.isPaused) {
        await api.resumeBot();
      } else {
        await api.pauseBot();
      }
      fetchState();
    } catch {
      setError('Failed to pause bot');
    }
  };

  const handleStop = async () => {
    try {
      await api.stopBot();
      fetchState();
    } catch {
      setError('Failed to stop bot');
    }
  };

  const handleUpdateSchedule = async (schedule: Partial<Schedule>) => {
    try {
      await api.updateSchedule(schedule);
      fetchState();
    } catch {
      setError('Failed to update schedule');
    }
  };

  const handleUpdateFrequency = async (frequency: Partial<FrequencySettings>) => {
    try {
      await api.updateFrequency(frequency);
      fetchState();
    } catch {
      setError('Failed to update frequency');
    }
  };

  const handleUpdatePersonality = async (personality: string) => {
    try {
      await api.updatePersonality(personality);
      fetchState();
    } catch {
      setError('Failed to update personality');
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        sessions={sessions}
        activeSession={activeSession}
        onSelectSession={setActiveSession}
      />

      <main className="flex-1 overflow-auto p-6">
        {error && (
          <div className="mb-4 p-4 bg-red-900/50 border border-red-800 rounded-lg text-red-200 text-sm">
            {error}
          </div>
        )}

        <div className="max-w-7xl mx-auto space-y-6">
          {/* Top Row: Command + Configuration */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CommandCard
              state={state}
              onStart={handleStart}
              onPause={handlePause}
              onStop={handleStop}
            />
            <ConfigurationCard
              state={state}
              onUpdateSchedule={handleUpdateSchedule}
              onUpdateFrequency={handleUpdateFrequency}
            />
          </div>

          {/* Personality */}
          <PersonalityCard
            personality={state.personality}
            onUpdate={handleUpdatePersonality}
          />

          {/* Analytics */}
          <AnalyticsSection state={state} />
        </div>
      </main>
    </div>
  );
}

export default App;
