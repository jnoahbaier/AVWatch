import { TextStyle } from 'react-native';

export const typography = {
  h1: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
    letterSpacing: -0.5,
  } as TextStyle,
  h2: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
    letterSpacing: -0.3,
  } as TextStyle,
  h3: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
  } as TextStyle,
  body: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 22,
  } as TextStyle,
  bodyMedium: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
  } as TextStyle,
  bodySemibold: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  } as TextStyle,
  small: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  } as TextStyle,
  smallMedium: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  } as TextStyle,
  caption: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  } as TextStyle,
  captionMedium: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  } as TextStyle,
  overline: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  } as TextStyle,
} as const;
