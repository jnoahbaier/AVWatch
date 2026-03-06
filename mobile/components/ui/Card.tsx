import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padded?: boolean;
}

export function Card({ children, style, padded = true }: CardProps) {
  return (
    <View style={[styles.card, padded && styles.padded, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.neutral[100],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  padded: {
    padding: spacing.base,
  },
});
