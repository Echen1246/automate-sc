import { useState } from 'react';
import { Bot, Plus, Trash2, X, Check } from 'lucide-react';
import type { Session, LoginStatus } from '../types';

interface SidebarProps {
  sessions: Session[];
  activeSession: string | null;
  loginStatus: LoginStatus;
  onSelectSession: (id: string) => void;
  onNewSession: (name: string) => void;
  onCompleteLogin: () => void;
  onCancelLogin: () => void;
  onDeleteSession: (id: string) => void;
}

export function Sidebar({
  sessions,
  activeSession,
  loginStatus,
  onSelectSession,
  onNewSession,
  onCompleteLogin,
  onCancelLogin,
  onDeleteSession,
}: SidebarProps) {
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim()) {
      onNewSession(newName.trim());
      setNewName('');
      setShowNewForm(false);
    }
  };

  const getStatusColor = (status: Session['status']) => {
    switch (status) {
      case 'running':
        return 'bg-emerald-500 shadow-lg shadow-emerald-500/50';
      case 'starting':
      case 'stopping':
        return 'bg-amber-500 animate-pulse';
      case 'paused':
        return 'bg-amber-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-slate-600';
    }
  };

  return (
    <aside className="w-72 h-screen bg-slate-900/50 border-r border-slate-800 flex flex-col">
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

      {/* Login in progress banner */}
      {loginStatus.inProgress && (
        <div className="p-3 m-3 bg-blue-900/50 border border-blue-700 rounded-lg">
          <p className="text-sm text-blue-200 mb-2">
            Logging in as: <strong>{loginStatus.name}</strong>
          </p>
          <p className="text-xs text-blue-300 mb-3">
            Complete login in the browser window, then click "Save Session"
          </p>
          <div className="flex gap-2">
            <button
              onClick={onCompleteLogin}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded"
            >
              <Check className="w-3 h-3" />
              Save Session
            </button>
            <button
              onClick={onCancelLogin}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium rounded"
            >
              <X className="w-3 h-3" />
              Cancel
            </button>
          </div>
        </div>
      )}

      <nav className="flex-1 p-3 overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider px-2">
            Sessions
          </p>
          <button
            onClick={() => setShowNewForm(true)}
            disabled={loginStatus.inProgress}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {showNewForm && !loginStatus.inProgress && (
          <form onSubmit={handleSubmit} className="mb-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Account name..."
              autoFocus
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 mb-2"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded"
              >
                Add & Login
              </button>
              <button
                type="button"
                onClick={() => setShowNewForm(false)}
                className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium rounded"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {sessions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-slate-500 mb-2">No sessions yet</p>
            <button
              onClick={() => setShowNewForm(true)}
              disabled={loginStatus.inProgress}
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              Add your first account
            </button>
          </div>
        ) : (
          <ul className="space-y-1">
            {sessions.map((session) => (
              <li key={session.id} className="group">
                <button
                  onClick={() => onSelectSession(session.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    activeSession === session.id
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${getStatusColor(session.status)}`} />
                  <span className="flex-1 text-left">
                    <span className="text-sm font-medium block">{session.name}</span>
                    <span className="text-xs text-slate-500 capitalize">{session.status}</span>
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete session "${session.name}"?`)) {
                        onDeleteSession(session.id);
                      }
                    }}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </button>
              </li>
            ))}
          </ul>
        )}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="text-xs text-slate-500">
          <p>automate-sc v2.2</p>
          <p className="text-slate-600">{sessions.length} session(s)</p>
        </div>
      </div>
    </aside>
  );
}
