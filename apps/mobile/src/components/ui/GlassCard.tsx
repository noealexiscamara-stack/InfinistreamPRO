import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { colors, radius, spacing } from '@/theme/tokens';

interface GlassCardProps extends ViewProps {
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}

/**
 * Cheap "glass" surface: translucent fill + hairline border, no blur.
 * Real BlurView is reserved for a few hero surfaces (see theme/tokens.ts)
 * — list rows and cards use this instead so scrolling stays smooth on
 * low-end Android GPUs (product rule #8).
 */
export function GlassCard({ style, padded = true, children, ...rest }: GlassCardProps) {
  return (
    <View style={[styles.base, padded && styles.padded, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surfaceGlass,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  padded: {
    padding: spacing.lg,
  },
});
