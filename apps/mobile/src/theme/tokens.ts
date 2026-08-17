/**
 * Infiny Stream design tokens — dark, premium, glassmorphism-light.
 * Single source of truth for colors/spacing/radius/typography so screens
 * stay visually consistent without every component re-inventing values.
 *
 * Performance note (see product rule #58: stability > performance >
 * simplicity > aesthetics > complexity): glass surfaces use a translucent
 * background + hairline border by default. Real blur (expo-blur) is
 * reserved for a handful of hero surfaces (player controls, modals) —
 * never list rows — because BlurView is comparatively expensive to
 * composite on low-end Android GPUs.
 */

export const colors = {
  background: '#0B0D12',
  backgroundElevated: '#12151C',
  surface: '#171B24',
  surfaceGlass: 'rgba(23, 27, 36, 0.72)',
  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.16)',

  textPrimary: '#F5F7FA',
  textSecondary: '#9AA3B2',
  textTertiary: '#5C6472',

  brand: '#5B8CFF',
  brandStrong: '#3D6BFF',
  gradientStart: '#5B8CFF',
  gradientEnd: '#8A5CFF',

  success: '#33D17A',
  warning: '#F2B33D',
  danger: '#FF5A5F',

  networkExcellent: '#33D17A',
  networkGood: '#7FDB6F',
  networkMedium: '#F2B33D',
  networkLow: '#FF5A5F',
  networkOffline: '#5C6472',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 32, fontWeight: '700' as const, letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3 },
  headline: { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodyStrong: { fontSize: 15, fontWeight: '600' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
  label: { fontSize: 12, fontWeight: '600' as const, letterSpacing: 0.4, textTransform: 'uppercase' as const },
};

export const motion = {
  fast: 150,
  normal: 220,
  slow: 320,
};

export const networkQualityColor: Record<'excellent' | 'good' | 'medium' | 'low' | 'offline', string> = {
  excellent: colors.networkExcellent,
  good: colors.networkGood,
  medium: colors.networkMedium,
  low: colors.networkLow,
  offline: colors.networkOffline,
};
