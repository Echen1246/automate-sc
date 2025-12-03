import { useState, useEffect } from 'react';
import { Calendar, Gauge, Save } from 'lucide-react';
import type { BotState, Schedule, FrequencySettings } from '../types';

interface ConfigurationCardProps {
  state: BotState;
  onUpdateSchedule: (schedule: Partial<Schedule>) => void;
  onUpdateFrequency: (frequency: Partial<FrequencySettings>) => void;
}

export function ConfigurationCard({ state, onUpdateSchedule, onUpdateFrequency }: ConfigurationCardProps) {
  const [schedule, setSchedule] = useState(state.schedule);
  const [frequency, setFrequency] = useState(state.frequency);

  useEffect(() => {
    setSchedule(state.schedule);
    setFrequency(state.frequency);
  }, [state.schedule, state.frequency]);

  const handleSaveSchedule = () => {
    onUpdateSchedule(schedule);
  };

  const handleSaveFrequency = () => {
    onUpdateFrequency(frequency);
  };

  return (
    <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-5">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Configuration</h2>
      </div>

      {/* Schedule Section */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-300">Schedule Manager</span>
        </div>

        <div className="space-y-3">
          <label className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Enable Schedule</span>
            <button
              onClick={() => setSchedule({ ...schedule, enabled: !schedule.enabled })}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                schedule.enabled ? 'bg-blue-600' : 'bg-slate-700'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  schedule.enabled ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Start Hour</label>
              <input
                type="number"
                min="0"
                max="23"
                value={schedule.startHour}
                onChange={(e) => setSchedule({ ...schedule, startHour: parseInt(e.target.value) || 0 })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">End Hour</label>
              <input
                type="number"
                min="0"
                max="23"
                value={schedule.endHour}
                onChange={(e) => setSchedule({ ...schedule, endHour: parseInt(e.target.value) || 0 })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <label className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Skip Weekends</span>
            <button
              onClick={() => setSchedule({ ...schedule, skipWeekends: !schedule.skipWeekends })}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                schedule.skipWeekends ? 'bg-blue-600' : 'bg-slate-700'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  schedule.skipWeekends ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </label>

          <button
            onClick={handleSaveSchedule}
            className="w-full flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Save className="w-4 h-4" />
            Save Schedule
          </button>
        </div>
      </div>

      {/* Frequency Section */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Gauge className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-300">Frequency Controls</span>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>Response Delay</span>
              <span>{(frequency.responseDelayMin / 1000).toFixed(1)}s - {(frequency.responseDelayMax / 1000).toFixed(1)}s</span>
            </div>
            <div className="flex gap-2">
              <input
                type="range"
                min="500"
                max="30000"
                step="500"
                value={frequency.responseDelayMin}
                onChange={(e) => setFrequency({ ...frequency, responseDelayMin: parseInt(e.target.value) })}
                className="flex-1 accent-blue-500"
              />
              <input
                type="range"
                min="500"
                max="60000"
                step="500"
                value={frequency.responseDelayMax}
                onChange={(e) => setFrequency({ ...frequency, responseDelayMax: parseInt(e.target.value) })}
                className="flex-1 accent-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500 block mb-1">Max Replies per Hour</label>
            <input
              type="number"
              min="1"
              max="100"
              value={frequency.maxRepliesPerHour}
              onChange={(e) => setFrequency({ ...frequency, maxRepliesPerHour: parseInt(e.target.value) || 10 })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <button
            onClick={handleSaveFrequency}
            className="w-full flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Save className="w-4 h-4" />
            Save Frequency
          </button>
        </div>
      </div>
    </div>
  );
}

