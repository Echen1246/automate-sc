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
  Legend,
} from 'recharts';
import type { SessionAnalytics } from '../types';

interface ChartsProps {
  analytics: SessionAnalytics | null;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[date.getDay()];
}

export function TrafficChart({ analytics }: ChartsProps) {
  if (!analytics) {
    return (
      <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl p-5 h-80 flex items-center justify-center">
        <p className="text-slate-500">Select a session to view traffic</p>
      </div>
    );
  }

  const data = analytics.dailyData.map((d) => ({
    ...d,
    day: formatDate(d.date),
  }));

  return (
    <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
        Traffic Volume (Last 7 Days)
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={0}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="day"
              tick={{ fill: '#64748b', fontSize: 11 }}
            />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              labelStyle={{ color: '#94a3b8' }}
              labelFormatter={(_, payload) => {
                if (payload && payload[0]) {
                  return payload[0].payload.date;
                }
                return '';
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: '12px' }}
              iconType="circle"
            />
            <Bar
              dataKey="received"
              name="Received"
              fill="#3b82f6"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="sent"
              name="Sent"
              fill="#22c55e"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function ResponseTimeChart({ analytics }: ChartsProps) {
  if (!analytics) {
    return (
      <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl p-5 h-80 flex items-center justify-center">
        <p className="text-slate-500">Select a session to view response times</p>
      </div>
    );
  }

  const data = analytics.responseTimes.map((time, i) => ({
    index: i + 1,
    time: Math.round(time / 1000),
  }));

  return (
    <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
        Response Time Trend
      </h3>
      <div className="h-64">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-500 text-sm">
            No response data yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="index"
                tick={{ fill: '#64748b', fontSize: 10 }}
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 10 }}
                unit="s"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  fontSize: '12px',
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
        )}
      </div>
    </div>
  );
}
