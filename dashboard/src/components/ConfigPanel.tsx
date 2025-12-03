import { useState, useEffect } from 'react';
import { Calendar, Gauge, Brain, Save } from 'lucide-react';
import type { GlobalConfig } from '../types';

interface ConfigPanelProps {
  config: GlobalConfig;
  onSave: (config: Partial<GlobalConfig>) => void;
}

export function ConfigPanel({ config, onSave }: ConfigPanelProps) {
  const [localConfig, setLocalConfig] = useState(config);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setLocalConfig(config);
    setHasChanges(false);
  }, [config]);

  const handleChange = (key: keyof GlobalConfig, value: unknown) => {
    setLocalConfig((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    onSave(localConfig);
    setHasChanges(false);
  };

  return (
    <div className="space-y-4">
      {/* Schedule */}
      <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
            Schedule
          </h3>
        </div>

        <div className="space-y-3">
          <label className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Enable Schedule</span>
            <button
              onClick={() => handleChange('scheduleEnabled', !localConfig.scheduleEnabled)}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                localConfig.scheduleEnabled ? 'bg-blue-600' : 'bg-slate-700'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  localConfig.scheduleEnabled ? 'left-6' : 'left-1'
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
                value={localConfig.scheduleStart}
                onChange={(e) => handleChange('scheduleStart', parseInt(e.target.value) || 0)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">End Hour</label>
              <input
                type="number"
                min="0"
                max="23"
                value={localConfig.scheduleEnd}
                onChange={(e) => handleChange('scheduleEnd', parseInt(e.target.value) || 0)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <label className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Skip Weekends</span>
            <button
              onClick={() => handleChange('skipWeekends', !localConfig.skipWeekends)}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                localConfig.skipWeekends ? 'bg-blue-600' : 'bg-slate-700'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  localConfig.skipWeekends ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </label>
        </div>
      </div>

      {/* Frequency */}
      <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Gauge className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
            Frequency
          </h3>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-xs text-slate-500 mb-2">
              <span>Response Delay</span>
              <span>
                {(localConfig.responseDelayMin / 1000).toFixed(1)}s -{' '}
                {(localConfig.responseDelayMax / 1000).toFixed(1)}s
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-600 block mb-1">Min (ms)</label>
                <input
                  type="number"
                  min="500"
                  max="30000"
                  step="500"
                  value={localConfig.responseDelayMin}
                  onChange={(e) => handleChange('responseDelayMin', parseInt(e.target.value) || 1500)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-600 block mb-1">Max (ms)</label>
                <input
                  type="number"
                  min="500"
                  max="60000"
                  step="500"
                  value={localConfig.responseDelayMax}
                  onChange={(e) => handleChange('responseDelayMax', parseInt(e.target.value) || 4000)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500 block mb-1">Max Replies Per Hour</label>
            <input
              type="number"
              min="1"
              max="100"
              value={localConfig.maxRepliesPerHour}
              onChange={(e) => handleChange('maxRepliesPerHour', parseInt(e.target.value) || 30)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Personality */}
      <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
            Personality
          </h3>
        </div>

        <div>
          <label className="text-xs text-slate-500 block mb-2">System Prompt</label>
          <textarea
            value={localConfig.personality}
            onChange={(e) => handleChange('personality', e.target.value)}
            rows={6}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono resize-none focus:outline-none focus:border-blue-500"
            placeholder="Define the bot's personality..."
          />
        </div>
      </div>

      {/* Save Button */}
      {hasChanges && (
        <button
          onClick={handleSave}
          className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-colors"
        >
          <Save className="w-4 h-4" />
          Save Configuration
        </button>
      )}
    </div>
  );
}

