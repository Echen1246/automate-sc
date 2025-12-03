import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, MessageSquare, Clock, Smile } from 'lucide-react';
import type { BotState } from '../types';

interface AnalyticsSectionProps {
  state: BotState;
}

function KPICard({
  icon: Icon,
  label,
  value,
  subtext,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subtext?: string;
  color: string;
}) {
  return (
    <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-xl font-bold text-white">{value}</p>
          {subtext && <p className="text-xs text-slate-500">{subtext}</p>}
        </div>
      </div>
    </div>
  );
}

export function AnalyticsSection({ state }: AnalyticsSectionProps) {
  const { stats, analytics } = state;

  // Calculate KPIs
  const replyRate = stats.messagesReceived > 0
    ? Math.round((stats.messagesSent / stats.messagesReceived) * 100)
    : 0;

  const avgConversationLength = analytics.conversationLengths.length > 0
    ? Math.round(analytics.conversationLengths.reduce((a, b) => a + b, 0) / analytics.conversationLengths.length)
    : 0;

  const avgResponseTime = analytics.responseTimes.length > 0
    ? Math.round(analytics.responseTimes.reduce((a, b) => a + b, 0) / analytics.responseTimes.length / 1000)
    : 0;

  // Sentiment mock (would need NLP integration)
  const sentimentScore = 72;

  return (
    <div className="space-y-4">
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={TrendingUp}
          label="Reply Rate"
          value={`${replyRate}%`}
          color="bg-emerald-600"
        />
        <KPICard
          icon={MessageSquare}
          label="Avg Conversation"
          value={avgConversationLength}
          subtext="messages"
          color="bg-blue-600"
        />
        <KPICard
          icon={Clock}
          label="Avg Response Time"
          value={`${avgResponseTime}s`}
          color="bg-purple-600"
        />
        <KPICard
          icon={Smile}
          label="Sentiment Score"
          value={sentimentScore}
          subtext="/100"
          color={sentimentScore > 60 ? 'bg-emerald-600' : sentimentScore > 40 ? 'bg-amber-600' : 'bg-red-600'}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Traffic Volume */}
        <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
            Traffic Volume (Hourly)
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.hourlyMessages}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="hour" tick={{ fill: '#64748b', fontSize: 10 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Bar dataKey="received" name="Received" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="sent" name="Sent" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Response Time Distribution */}
        <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
            Response Time Distribution
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={analytics.responseTimes.slice(-20).map((time, i) => ({
                  index: i,
                  time: Math.round(time / 1000),
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="index" tick={{ fill: '#64748b', fontSize: 10 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} unit="s" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`${value}s`, 'Response Time']}
                />
                <Area
                  type="monotone"
                  dataKey="time"
                  stroke="#8b5cf6"
                  fill="#8b5cf6"
                  fillOpacity={0.2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
          Session Summary
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-2xl font-bold text-white">{stats.messagesReceived}</p>
            <p className="text-xs text-slate-500">Messages Received</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{stats.messagesSent}</p>
            <p className="text-xs text-slate-500">Messages Sent</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{analytics.repliesThisHour}</p>
            <p className="text-xs text-slate-500">Replies This Hour</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{analytics.conversationLengths.length}</p>
            <p className="text-xs text-slate-500">Conversations</p>
          </div>
        </div>
      </div>
    </div>
  );
}

