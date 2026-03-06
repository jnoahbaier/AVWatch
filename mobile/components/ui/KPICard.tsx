import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from './Card';
import { TrendBadge } from './TrendBadge';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

interface KPICardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  trend?: number;
  trendLabel?: string;
  iconBg?: string;
}

export function KPICard({
  icon,
  label,
  value,
  trend,
  trendLabel = 'Last 30 days',
  iconBg = colors.primary[50],
}: KPICardProps) {
  return (
    <Card style={styles.card}>
      <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>{icon}</View>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {trend !== undefined && (
        <View style={styles.trendRow}>
          <TrendBadge value={trend} />
          <Text style={styles.trendLabel}>{trendLabel}</Text>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 150,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  label: {
    ...typography.caption,
    color: colors.neutral[500],
    marginBottom: 2,
  },
  value: {
    ...typography.h2,
    color: colors.neutral[900],
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: 6,
  },
  trendLabel: {
    ...typography.caption,
    color: colors.neutral[400],
  },
});
