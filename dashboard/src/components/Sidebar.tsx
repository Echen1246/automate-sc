import { Bot, Settings, BarChart3, Users } from 'lucide-react';
import type { BotSession } from '../types';

interface SidebarProps {
  sessions: BotSession[];
  activeSession: string;
  onSelectSession: (id: string) => void;
}

export function Sidebar({ sessions, activeSession, onSelectSession }: SidebarProps) {
  return (
    <aside className="w-64 h-screen bg-slate-900/50 border-r border-slate-800 flex flex-col">
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center">
            <Bot className="w-5 h-5 text-slate-900" />
          </div>
          <div>
            <h1 className="font-semibold text-white">Command Center</h1>
            <p className="text-xs text-slate-500">Snapchat Automation</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3">
        <div className="mb-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider px-3 mb-2">
            Bot Sessions
          </p>
          <ul className="space-y-1">
            {sessions.map((session) => (
              <li key={session.id}>
                <button
                  onClick={() => onSelectSession(session.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    activeSession === session.id
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      session.status === 'running'
                        ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50'
                        : session.status === 'paused'
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                    }`}
                  />
                  <Users className="w-4 h-4" />
                  <span className="text-sm font-medium">{session.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t border-slate-800 pt-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider px-3 mb-2">
            Navigation
          </p>
          <ul className="space-y-1">
            <li>
              <a
                href="#"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
              >
                <BarChart3 className="w-4 h-4" />
                <span className="text-sm font-medium">Analytics</span>
              </a>
            </li>
            <li>
              <a
                href="#"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
              >
                <Settings className="w-4 h-4" />
                <span className="text-sm font-medium">Settings</span>
              </a>
            </li>
          </ul>
        </div>
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="text-xs text-slate-500">
          <p>automate-sc v2.0</p>
        </div>
      </div>
    </aside>
  );
}

