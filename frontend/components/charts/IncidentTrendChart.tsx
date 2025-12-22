'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { INCIDENT_TYPE_COLORS } from '@/lib/utils';

interface TrendData {
  date: string;
  collision?: number;
  near_miss?: number;
  sudden_behavior?: number;
  blockage?: number;
  other?: number;
  total?: number;
}

interface IncidentTrendChartProps {
  data: TrendData[];
  showByType?: boolean;
  height?: number;
}

export function IncidentTrendChart({
  data,
  showByType = false,
  height = 300,
}: IncidentTrendChartProps) {
  const formattedData = data.map((item) => ({
    ...item,
    dateLabel: format(parseISO(item.date), 'MMM d'),
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart
        data={formattedData}
        margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
        <XAxis
          dataKey="dateLabel"
          stroke="#9ca3af"
          fontSize={12}
          tickLine={false}
          axisLine={false}
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
          formatter={(value: number, name: string) => [
            value,
            name.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
          ]}
          labelFormatter={(label) => `Date: ${label}`}
        />
        {showByType ? (
          <>
            <Legend
              wrapperStyle={{ paddingTop: '20px' }}
              formatter={(value: string) =>
                value.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
              }
            />
            <Line
              type="monotone"
              dataKey="collision"
              stroke={INCIDENT_TYPE_COLORS.collision}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="near_miss"
              stroke={INCIDENT_TYPE_COLORS.near_miss}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="sudden_behavior"
              stroke={INCIDENT_TYPE_COLORS.sudden_behavior}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="blockage"
              stroke={INCIDENT_TYPE_COLORS.blockage}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </>
        ) : (
          <Line
            type="monotone"
            dataKey="total"
            stroke="#22c55e"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6, fill: '#22c55e' }}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}

