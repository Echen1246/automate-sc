import { Play, Pause, Square, Clock, Activity, Timer } from 'lucide-react';
import type { Session } from '../types';

interface CommandCardProps {
  session: Session | null;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return '-';
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function formatUptime(startedAt: string | null): string {
  if (!startedAt) return '00:00:00';
  const diff = Date.now() - new Date(startedAt).getTime();
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function CommandCard({ session, onStart, onPause, onResume, onStop }: CommandCardProps) {
  if (!session) {
    return (
      <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl p-8 flex items-center justify-center">
        <p className="text-slate-500">Select a session to control</p>
      </div>
    );
  }

  const getStatusDisplay = () => {
    switch (session.status) {
      case 'running':
        return { text: 'RUNNING', color: 'text-emerald-400', bg: 'bg-emerald-500/10' };
      case 'starting':
        return { text: 'STARTING', color: 'text-amber-400', bg: 'bg-amber-500/10' };
      case 'stopping':
        return { text: 'STOPPING', color: 'text-amber-400', bg: 'bg-amber-500/10' };
      case 'paused':
        return { text: 'PAUSED', color: 'text-amber-400', bg: 'bg-amber-500/10' };
      case 'error':
        return { text: 'ERROR', color: 'text-red-400', bg: 'bg-red-500/10' };
      default:
        return { text: 'STOPPED', color: 'text-slate-400', bg: 'bg-slate-500/10' };
    }
  };

  const status = getStatusDisplay();
  const isRunning = session.status === 'running';
  const isPaused = session.status === 'paused';
  const isStopped = session.status === 'stopped';
  const isTransitioning = session.status === 'starting' || session.status === 'stopping';

  return (
    <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold text-white">{session.name}</h2>
          <p className="text-xs text-slate-500">Session: {session.id}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${status.bg} ${status.color}`}>
          {status.text}
        </span>
      </div>

      <div className="flex gap-3 mb-6">
        {isStopped && (
          <button
            onClick={onStart}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/25 hover:shadow-emerald-500/40 transition-all"
          >
            <Play className="w-4 h-4" />
            Start Bot
          </button>
        )}

        {isRunning && (
          <>
            <button
              onClick={onPause}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium bg-amber-600 hover:bg-amber-500 text-white transition-all"
            >
              <Pause className="w-4 h-4" />
              Pause
            </button>
            <button
              onClick={onStop}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium bg-red-600 hover:bg-red-500 text-white transition-all"
            >
              <Square className="w-4 h-4" />
              Stop
            </button>
          </>
        )}

        {isPaused && (
          <>
            <button
              onClick={onResume}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/25 transition-all"
            >
              <Play className="w-4 h-4" />
              Resume
            </button>
            <button
              onClick={onStop}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium bg-red-600 hover:bg-red-500 text-white transition-all"
            >
              <Square className="w-4 h-4" />
              Stop
            </button>
          </>
        )}

        {isTransitioning && (
          <div className="flex-1 flex items-center justify-center py-3 text-slate-400">
            <span className="animate-pulse">Processing...</span>
          </div>
        )}
      </div>

      {session.stats && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-xs">Started At</span>
            </div>
            <p className="text-sm font-medium text-white">
              {session.stats.startedAt
                ? new Date(session.stats.startedAt).toLocaleTimeString()
                : '-'}
            </p>
          </div>

          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <Activity className="w-3.5 h-3.5" />
              <span className="text-xs">Last Activity</span>
            </div>
            <p className="text-sm font-medium text-white">
              {formatRelativeTime(session.stats.lastActivity)}
            </p>
          </div>

          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <Timer className="w-3.5 h-3.5" />
              <span className="text-xs">Uptime</span>
            </div>
            <p className="text-sm font-mono font-medium text-white">
              {formatUptime(session.stats.startedAt)}
            </p>
          </div>
        </div>
      )}

      {session.stats && (
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="bg-slate-800/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-400">{session.stats.messagesReceived}</p>
            <p className="text-xs text-slate-500">Messages Received</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-emerald-400">{session.stats.messagesSent}</p>
            <p className="text-xs text-slate-500">Messages Sent</p>
          </div>
        </div>
      )}
    </div>
  );
}
