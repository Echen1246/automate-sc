import { MessageSquare, Send, Clock, TrendingUp, Users } from 'lucide-react';
import type { Analytics } from '../types';

interface KPICardsProps {
  analytics: Analytics;
}

interface KPICardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subtext?: string;
  color: string;
  trend?: 'up' | 'down' | 'neutral';
}

function KPICard({ icon: Icon, label, value, subtext, color, trend }: KPICardProps) {
  return (
    <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl p-4">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        {trend && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            trend === 'up' ? 'bg-emerald-500/20 text-emerald-400' :
            trend === 'down' ? 'bg-red-500/20 text-red-400' :
            'bg-slate-500/20 text-slate-400'
          }`}>
            {trend === 'up' ? '+' : trend === 'down' ? '-' : ''}
          </span>
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
        {subtext && <p className="text-xs text-slate-600 mt-1">{subtext}</p>}
      </div>
    </div>
  );
}

export function KPICards({ analytics }: KPICardsProps) {
  const formatTime = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
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
      <KPICard
        icon={Users}
        label="Active Bots"
        value={analytics.activeBots}
        color="bg-cyan-600"
      />
    </div>
  );
}

