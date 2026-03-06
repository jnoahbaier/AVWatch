import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

interface DataPoint {
  label: string;
  value: number;
}

interface LineChartProps {
  data: DataPoint[];
  width?: number;
  height?: number;
  color?: string;
  showLabels?: boolean;
  highlightLast?: boolean;
}

export function LineChart({
  data,
  width = 320,
  height = 180,
  color = colors.primary[500],
  showLabels = true,
  highlightLast = true,
}: LineChartProps) {
  if (data.length < 2) return null;

  const padding = { top: 20, right: 20, bottom: showLabels ? 30 : 10, left: 10 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const values = data.map((d) => d.value);
  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values, 0);
  const range = maxVal - minVal || 1;

  const points = data.map((d, i) => ({
    x: padding.left + (i / (data.length - 1)) * chartW,
    y: padding.top + chartH - ((d.value - minVal) / range) * chartH,
  }));

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  const fillPath = `${linePath} L ${points[points.length - 1].x} ${
    padding.top + chartH
  } L ${points[0].x} ${padding.top + chartH} Z`;

  const lastPoint = points[points.length - 1];
  const lastValue = data[data.length - 1];

  return (
    <View>
      <Svg width={width} height={height}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const y = padding.top + chartH * (1 - frac);
          return (
            <Line
              key={frac}
              x1={padding.left}
              y1={y}
              x2={padding.left + chartW}
              y2={y}
              stroke={colors.neutral[100]}
              strokeWidth={1}
            />
          );
        })}

        {/* Area fill */}
        <Path d={fillPath} fill={color} opacity={0.08} />

        {/* Line */}
        <Path d={linePath} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />

        {/* Highlight last point */}
        {highlightLast && (
          <>
            <Circle cx={lastPoint.x} cy={lastPoint.y} r={5} fill="#fff" stroke={color} strokeWidth={2.5} />
          </>
        )}

        {/* X-axis labels */}
        {showLabels &&
          data.map((d, i) => {
            if (data.length > 7 && i % 2 !== 0 && i !== data.length - 1) return null;
            return (
              <SvgText
                key={i}
                x={points[i].x}
                y={height - 4}
                fontSize={11}
                fill={colors.neutral[400]}
                textAnchor="middle"
              >
                {d.label}
              </SvgText>
            );
          })}
      </Svg>

      {highlightLast && (
        <View
          style={[
            styles.tooltip,
            {
              left: Math.min(lastPoint.x - 30, width - 80),
              top: lastPoint.y - 36,
            },
          ]}
        >
          <Text style={styles.tooltipText}>
            ${lastValue.value.toLocaleString()}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tooltip: {
    position: 'absolute',
    backgroundColor: colors.neutral[800],
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tooltipText: {
    ...typography.captionMedium,
    color: '#fff',
  },
});
