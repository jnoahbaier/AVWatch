import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { radius } from '@/theme/spacing';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
      style={[
        styles.base,
        sizeStyles[size],
        variantStyles[variant],
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? '#fff' : colors.primary[600]}
          size="small"
        />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.text,
              sizeTextStyles[size],
              variantTextStyles[variant],
              icon ? { marginLeft: 8 } : undefined,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    ...typography.bodySemibold,
  },
});

const sizeStyles: Record<string, ViewStyle> = {
  sm: { paddingVertical: 8, paddingHorizontal: 16 },
  md: { paddingVertical: 12, paddingHorizontal: 24 },
  lg: { paddingVertical: 16, paddingHorizontal: 32, minHeight: 56 },
};

const sizeTextStyles: Record<string, TextStyle> = {
  sm: { fontSize: 14 },
  md: { fontSize: 16 },
  lg: { fontSize: 18 },
};

const variantStyles: Record<string, ViewStyle> = {
  primary: { backgroundColor: colors.primary[600] },
  secondary: { backgroundColor: colors.neutral[100] },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.neutral[200],
  },
  ghost: { backgroundColor: 'transparent' },
};

const variantTextStyles: Record<string, TextStyle> = {
  primary: { color: '#ffffff' },
  secondary: { color: colors.neutral[800] },
  outline: { color: colors.neutral[700] },
  ghost: { color: colors.primary[600] },
};
