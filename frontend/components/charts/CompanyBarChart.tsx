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
  Legend,
} from 'recharts';
import { AV_COMPANY_COLORS, AV_COMPANY_LABELS } from '@/lib/utils';

interface CompanyData {
  company: string;
  total: number;
  collisions?: number;
  near_misses?: number;
  sudden_behaviors?: number;
  blockages?: number;
}

interface CompanyBarChartProps {
  data: CompanyData[];
  showBreakdown?: boolean;
  height?: number;
}

export function CompanyBarChart({
  data,
  showBreakdown = false,
  height = 300,
}: CompanyBarChartProps) {
  const formattedData = data.map((item) => ({
    ...item,
    name: AV_COMPANY_LABELS[item.company] || item.company,
    fill: AV_COMPANY_COLORS[item.company] || '#94a3b8',
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={formattedData}
        layout="vertical"
        margin={{ top: 5, right: 20, left: 60, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
        <XAxis
          type="number"
          stroke="#9ca3af"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          stroke="#9ca3af"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          width={60}
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
          cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
        />
        {showBreakdown ? (
          <>
            <Legend />
            <Bar dataKey="collisions" stackId="a" fill="#ef4444" name="Collisions" />
            <Bar dataKey="near_misses" stackId="a" fill="#f97316" name="Near Misses" />
            <Bar dataKey="sudden_behaviors" stackId="a" fill="#eab308" name="Sudden Behavior" />
            <Bar dataKey="blockages" stackId="a" fill="#6366f1" name="Blockages" />
          </>
        ) : (
          <Bar dataKey="total" radius={[0, 4, 4, 0]}>
            {formattedData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}



