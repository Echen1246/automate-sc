import { MessageSquare, Send, Clock, TrendingUp } from 'lucide-react';
import type { SessionAnalytics } from '../types';

interface KPICardsProps {
  analytics: SessionAnalytics | null;
  sessionName: string | null;
}

interface KPICardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subtext?: string;
  color: string;
}

function KPICard({ icon: Icon, label, value, color }: KPICardProps) {
  return (
    <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl p-4">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}

export function KPICards({ analytics, sessionName }: KPICardsProps) {
  if (!analytics) {
    return (
      <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl p-8">
        <p className="text-slate-500 text-center">Select a session to view analytics</p>
      </div>
    );
  }

  const formatTime = (ms: number): string => {
    if (ms === 0) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="space-y-4">
      {sessionName && (
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{sessionName}</h2>
          <span className="text-xs text-slate-500">Analytics</span>
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={MessageSquare}
          label="Messages Received"
          value={analytics.totalReceived}
          color="bg-blue-600"
        />
        <KPICard
          icon={Send}
          label="Messages Sent"
          value={analytics.totalSent}
          color="bg-emerald-600"
        />
        <KPICard
          icon={TrendingUp}
          label="Reply Rate"
          value={`${analytics.replyRate}%`}
          color="bg-purple-600"
        />
        <KPICard
          icon={Clock}
          label="Avg Response Time"
          value={formatTime(analytics.avgResponseTime)}
          color="bg-amber-600"
        />
      </div>
    </div>
  );
}
