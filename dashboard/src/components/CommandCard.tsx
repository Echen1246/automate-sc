import { Play, Pause, Square, Clock, Activity, Timer } from 'lucide-react';
import type { BotState } from '../types';

interface CommandCardProps {
  state: BotState;
  onStart: () => void;
  onPause: () => void;
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

export function CommandCard({ state, onStart, onPause, onStop }: CommandCardProps) {
  const getStatus = () => {
    if (!state.isRunning) return { text: 'STOPPED', color: 'text-red-400', bg: 'bg-red-500/10' };
    if (state.isPaused) return { text: 'PAUSED', color: 'text-amber-400', bg: 'bg-amber-500/10' };
    return { text: 'RUNNING', color: 'text-emerald-400', bg: 'bg-emerald-500/10' };
  };

  const status = getStatus();
  const isRunning = state.isRunning && !state.isPaused;

  return (
    <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Command</h2>
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${status.bg} ${status.color}`}>
          {status.text}
        </span>
      </div>

      <div className="flex gap-3 mb-6">
        <button
          onClick={state.isPaused ? onStart : onStart}
          disabled={isRunning}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-all ${
            isRunning
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/25 hover:shadow-emerald-500/40'
          }`}
        >
          <Play className="w-4 h-4" />
          Start
        </button>

        <button
          onClick={state.isPaused ? onStart : onPause}
          disabled={!state.isRunning}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-all ${
            !state.isRunning
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
              : 'bg-amber-600 hover:bg-amber-500 text-white'
          }`}
        >
          <Pause className="w-4 h-4" />
          {state.isPaused ? 'Resume' : 'Pause'}
        </button>

        <button
          onClick={onStop}
          disabled={!state.isRunning}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-all ${
            !state.isRunning
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
              : 'bg-red-600 hover:bg-red-500 text-white'
          }`}
        >
          <Square className="w-4 h-4" />
          Stop
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-slate-500 mb-1">
            <Clock className="w-3.5 h-3.5" />
            <span className="text-xs">Started At</span>
          </div>
          <p className="text-sm font-medium text-white">
            {state.stats.startedAt
              ? new Date(state.stats.startedAt).toLocaleTimeString()
              : '-'}
          </p>
        </div>

        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-slate-500 mb-1">
            <Activity className="w-3.5 h-3.5" />
            <span className="text-xs">Last Activity</span>
          </div>
          <p className="text-sm font-medium text-white">
            {formatRelativeTime(state.stats.lastActivity)}
          </p>
        </div>

        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-slate-500 mb-1">
            <Timer className="w-3.5 h-3.5" />
            <span className="text-xs">Uptime</span>
          </div>
          <p className="text-sm font-mono font-medium text-white">
            {formatUptime(state.stats.startedAt)}
          </p>
        </div>
      </div>
    </div>
  );
}

