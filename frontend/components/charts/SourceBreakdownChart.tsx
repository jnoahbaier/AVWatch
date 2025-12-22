'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface SourceData {
  source: string;
  count: number;
}

interface SourceBreakdownChartProps {
  data: SourceData[];
  height?: number;
}

const SOURCE_COLORS: Record<string, string> = {
  user_report: '#22c55e',
  nhtsa: '#3b82f6',
  cpuc: '#8b5cf6',
  dmv: '#f59e0b',
};

const SOURCE_LABELS: Record<string, string> = {
  user_report: 'Community Reports',
  nhtsa: 'NHTSA SGO',
  cpuc: 'CPUC',
  dmv: 'CA DMV',
};

export function SourceBreakdownChart({
  data,
  height = 200,
}: SourceBreakdownChartProps) {
  const formattedData = data.map((item) => ({
    name: SOURCE_LABELS[item.source] || item.source,
    value: item.count,
    fill: SOURCE_COLORS[item.source] || '#94a3b8',
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={formattedData}
        margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
        <XAxis
          dataKey="name"
          stroke="#9ca3af"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          angle={-15}
          textAnchor="end"
          height={50}
        />
        <YAxis
          stroke="#9ca3af"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1f2937',
            border: '1px solid #374151',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
          }}
          labelStyle={{ color: '#f3f4f6' }}
          itemStyle={{ color: '#d1d5db' }}
          formatter={(value: number) => [value, 'Records']}
          cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {formattedData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

