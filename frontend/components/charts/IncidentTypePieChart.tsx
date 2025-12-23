'use client';

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { INCIDENT_TYPE_COLORS, INCIDENT_TYPE_LABELS } from '@/lib/utils';

interface TypeData {
  type: string;
  count: number;
}

interface IncidentTypePieChartProps {
  data: TypeData[];
  height?: number;
  showLegend?: boolean;
}

const RADIAN = Math.PI / 180;

const renderCustomizedLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  percent: number;
}) => {
  if (percent < 0.05) return null;
  
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={12}
      fontWeight={600}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export function IncidentTypePieChart({
  data,
  height = 300,
  showLegend = true,
}: IncidentTypePieChartProps) {
  const formattedData = data.map((item) => ({
    name: INCIDENT_TYPE_LABELS[item.type] || item.type,
    value: item.count,
    fill: INCIDENT_TYPE_COLORS[item.type] || '#64748b',
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={formattedData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={renderCustomizedLabel}
          outerRadius={height / 3}
          innerRadius={height / 6}
          fill="#8884d8"
          dataKey="value"
          stroke="transparent"
        >
          {formattedData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: '#1f2937',
            border: '1px solid #374151',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
          }}
          labelStyle={{ color: '#f3f4f6' }}
          itemStyle={{ color: '#d1d5db' }}
          formatter={(value: number) => [value, 'Incidents']}
        />
        {showLegend && (
          <Legend
            layout="vertical"
            align="right"
            verticalAlign="middle"
            iconType="circle"
            iconSize={10}
            wrapperStyle={{ paddingLeft: '20px' }}
          />
        )}
      </PieChart>
    </ResponsiveContainer>
  );
}



