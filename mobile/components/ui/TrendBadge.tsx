import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

interface TrendBadgeProps {
  value: number;
  label?: string;
}

export function TrendBadge({ value, label }: TrendBadgeProps) {
  const isPositive = value >= 0;
  const bgColor = isPositive ? colors.green[50] : colors.red[50];
  const textColor = isPositive ? colors.green[600] : colors.red[600];
  const icon = isPositive ? 'trending-up' : 'trending-down';
  const sign = isPositive ? '+' : '';

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <Ionicons name={icon} size={12} color={textColor} />
      <Text style={[styles.text, { color: textColor }]}>
        {sign}
        {value.toFixed(1)}%
      </Text>
      {label && (
        <Text style={[styles.label, { color: textColor }]}>{label}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 3,
  },
  text: {
    ...typography.captionMedium,
  },
  label: {
    ...typography.caption,
  },
});
