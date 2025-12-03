import { useState, useEffect, useRef } from 'react';
import { Calendar, Gauge, Brain, Key, Filter, Save } from 'lucide-react';
import type { SessionConfig } from '../types';

interface ConfigPanelProps {
  config: SessionConfig | null;
  sessionId: string | null;
  sessionName: string | null;
  onSave: (config: Partial<SessionConfig>) => void;
}

export function ConfigPanel({ config, sessionId, sessionName, onSave }: ConfigPanelProps) {
  const [localConfig, setLocalConfig] = useState<SessionConfig | null>(config);
  const [hasChanges, setHasChanges] = useState(false);
  const [ignoreListText, setIgnoreListText] = useState('');
  const [saving, setSaving] = useState(false);
  const lastSessionId = useRef<string | null>(null);

  // Only reset local config when SESSION changes, not when config prop updates
  useEffect(() => {
    if (sessionId !== lastSessionId.current) {
      lastSessionId.current = sessionId;
      setLocalConfig(config);
      setIgnoreListText(config?.ignoreList?.join(', ') || '');
      setHasChanges(false);
    }
  }, [sessionId, config]);

  // Update local config from server ONLY if we don't have unsaved changes
  useEffect(() => {
    if (!hasChanges && config && sessionId === lastSessionId.current) {
      setLocalConfig(config);
      setIgnoreListText(config?.ignoreList?.join(', ') || '');
    }
  }, [config, hasChanges, sessionId]);

  if (!config || !localConfig) {
    return (
      <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl p-8">
        <p className="text-slate-500 text-center">Select a session to configure</p>
      </div>
    );
  }

  const handleChange = (key: keyof SessionConfig, value: unknown) => {
    setLocalConfig((prev) => prev ? { ...prev, [key]: value } : null);
    setHasChanges(true);
  };

  const handleIgnoreListChange = (text: string) => {
    setIgnoreListText(text);
    const list = text.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
    handleChange('ignoreList', list);
  };

  const handleSave = async () => {
    if (localConfig) {
      setSaving(true);
      await onSave(localConfig);
      setHasChanges(false);
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {sessionName && (
        <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl p-4">
          <p className="text-sm text-slate-400">
            Configuring: <span className="text-white font-medium">{sessionName}</span>
            {hasChanges && <span className="text-amber-400 ml-2">(unsaved changes)</span>}
          </p>
        </div>
      )}

      {/* AI Configuration */}
      <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Key className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
            AI Configuration
          </h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-slate-500 block mb-1">
              API Key <span className="text-slate-600">(leave empty to use global .env)</span>
            </label>
            <input
              type="password"
              value={localConfig.aiApiKey}
              onChange={(e) => handleChange('aiApiKey', e.target.value)}
              placeholder="sk-..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Model</label>
              <select
                value={localConfig.aiModel}
                onChange={(e) => handleChange('aiModel', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="deepseek-chat">DeepSeek Chat</option>
                <option value="deepseek-coder">DeepSeek Coder</option>
                <option value="gpt-4">GPT-4 (OpenAI key required)</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Temperature ({localConfig.aiTemperature})</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={localConfig.aiTemperature}
                onChange={(e) => handleChange('aiTemperature', parseFloat(e.target.value))}
                className="w-full accent-blue-500"
              />
            </div>
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

      {/* Ignore List */}
      <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
            Ignore List
          </h3>
        </div>

        <div>
          <label className="text-xs text-slate-500 block mb-2">
            Conversations to ignore (comma-separated)
          </label>
          <input
            type="text"
            value={ignoreListText}
            onChange={(e) => handleIgnoreListChange(e.target.value)}
            placeholder="My AI, Team Snapchat"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Snap Response */}
      <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
            Snap Response
          </h3>
        </div>

        <div>
          <label className="text-xs text-slate-500 block mb-2">
            Auto-reply when someone sends a photo/video (leave empty to skip)
          </label>
          <input
            type="text"
            value={localConfig.snapResponse}
            onChange={(e) => handleChange('snapResponse', e.target.value)}
            placeholder="i dont send pics here but you can see more on my twitter @yourhandle"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Save Button */}
      {hasChanges && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-medium rounded-xl transition-colors"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      )}
    </div>
  );
}
