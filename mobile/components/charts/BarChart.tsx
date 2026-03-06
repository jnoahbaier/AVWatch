import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

interface BarItem {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: BarItem[];
  maxValue?: number;
  showPercentage?: boolean;
}

export function BarChart({ data, maxValue, showPercentage = true }: BarChartProps) {
  const max = maxValue || Math.max(...data.map((d) => d.value), 1);
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <View style={styles.container}>
      {data.map((item, i) => {
        const pct = total > 0 ? (item.value / total) * 100 : 0;
        const barWidth = max > 0 ? (item.value / max) * 100 : 0;
        const barColor = item.color || colors.primary[500];

        return (
          <View key={i} style={styles.row}>
            <Text style={styles.label} numberOfLines={1}>
              {item.label}
            </Text>
            <View style={styles.barContainer}>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${barWidth}%`, backgroundColor: barColor },
                  ]}
                />
                {/* Layered lighter shades for depth */}
                <View
                  style={[
                    styles.barFillLight,
                    {
                      width: `${barWidth}%`,
                      backgroundColor: barColor,
                      opacity: 0.2,
                    },
                  ]}
                />
              </View>
              <Text style={styles.value}>
                {showPercentage ? `${pct.toFixed(0)}%` : item.value.toLocaleString()}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  label: {
    ...typography.small,
    color: colors.neutral[600],
    width: 80,
    textAlign: 'right',
  },
  barContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  barTrack: {
    flex: 1,
    height: 24,
    backgroundColor: colors.neutral[100],
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  barFill: {
    height: '100%',
    borderRadius: 6,
    opacity: 0.85,
  },
  barFillLight: {
    position: 'absolute',
    height: '100%',
    borderRadius: 6,
    top: 0,
    left: 0,
  },
  value: {
    ...typography.captionMedium,
    color: colors.neutral[500],
    width: 40,
  },
});
