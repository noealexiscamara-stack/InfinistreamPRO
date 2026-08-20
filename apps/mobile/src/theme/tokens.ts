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
  background: '#070B16',
  backgroundElevated: '#0E1422',
  backgroundGlow: '#122038',
  surface: '#141B2A',
  surfaceGlass: 'rgba(18, 26, 42, 0.72)',
  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.16)',

  textPrimary: '#F5F7FA',
  textSecondary: '#9AA3B2',
  textTertiary: '#5C6472',

  brand: '#5B8CFF',
  brandStrong: '#3D6BFF',
  cyan: '#4EC4FF',
  gradientStart: '#4EC4FF',
  gradientEnd: '#5B8CFF',

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
  hero: { fontSize: 26, fontWeight: '700' as const, letterSpacing: -0.4 },
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

export const networkQualityColor: Record<'excellent' | 'good' | 'medium' | 'low' | 'unknown' | 'offline', string> = {
  excellent: colors.networkExcellent,
  good: colors.networkGood,
  medium: colors.networkMedium,
  low: colors.networkLow,
  unknown: colors.textTertiary,
  offline: colors.networkOffline,
};

/** Universe identity — shared between mobile home and future TV shell. */
export type UniverseId = 'live' | 'movies' | 'series' | 'radios' | 'replay' | 'favorites' | 'categories' | 'search';

export interface UniverseTheme {
  /** Top → bottom tile gradient. */
  gradient: readonly [string, string];
  accent: string;
  glow: string;
}

export const universeThemes: Record<UniverseId, UniverseTheme> = {
  live: {
    gradient: ['#1B4D8C', '#0A1628'],
    accent: '#4EC4FF',
    glow: 'rgba(78, 196, 255, 0.35)',
  },
  movies: {
    gradient: ['#5B2D8C', '#120A22'],
    accent: '#B57BFF',
    glow: 'rgba(181, 123, 255, 0.35)',
  },
  series: {
    gradient: ['#0D6B6B', '#071A1A'],
    accent: '#2DD4BF',
    glow: 'rgba(45, 212, 191, 0.35)',
  },
  radios: {
    gradient: ['#0D6B6B', '#071A1A'],
    accent: '#2DD4BF',
    glow: 'rgba(45, 212, 191, 0.28)',
  },
  replay: {
    gradient: ['#8B4A12', '#1A1008'],
    accent: '#F59E0B',
    glow: 'rgba(245, 158, 11, 0.35)',
  },
  favorites: {
    gradient: ['#7A2D5C', '#160810'],
    accent: '#F472B6',
    glow: 'rgba(244, 114, 182, 0.35)',
  },
  categories: {
    gradient: ['#2A3140', '#0C0E14'],
    accent: '#9AA3B2',
    glow: 'rgba(154, 163, 178, 0.25)',
  },
  search: {
    gradient: ['#2A3140', '#0C0E14'],
    accent: '#9AA3B2',
    glow: 'rgba(154, 163, 178, 0.25)',
  },
};

export const elevation = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 10,
  },
  cardSubtle: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  cardGlow: (glowColor: string) => ({
    shadowColor: glowColor,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 14,
    elevation: 8,
  }),
} as const;
