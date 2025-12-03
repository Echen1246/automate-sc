import { useState, useEffect } from 'react';
import { Brain, Save } from 'lucide-react';

interface PersonalityCardProps {
  personality: string;
  onUpdate: (personality: string) => void;
}

export function PersonalityCard({ personality, onUpdate }: PersonalityCardProps) {
  const [value, setValue] = useState(personality);

  useEffect(() => {
    setValue(personality);
  }, [personality]);

  const handleSave = () => {
    onUpdate(value);
  };

  return (
    <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Brain className="w-4 h-4 text-slate-500" />
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Personality Matrix</h2>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-slate-500 block mb-2">System Prompt</label>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={8}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono resize-none focus:outline-none focus:border-blue-500"
            placeholder="Define the bot's personality and behavior..."
          />
        </div>

        <button
          onClick={handleSave}
          className="w-full flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Save className="w-4 h-4" />
          Save Personality
        </button>
      </div>
    </div>
  );
}

