import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

interface SectionHeaderProps {
  title: string;
  action?: string;
  onAction?: () => void;
}

export function SectionHeader({ title, action, onAction }: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {action && onAction && (
        <TouchableOpacity onPress={onAction}>
          <Text style={styles.action}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.base,
  },
  title: {
    ...typography.h3,
    color: colors.neutral[900],
  },
  action: {
    ...typography.smallMedium,
    color: colors.primary[600],
  },
});
