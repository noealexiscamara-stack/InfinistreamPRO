import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import { colors, typography } from '@/theme/tokens';

interface InfinyStreamLogoProps {
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}

export function InfinyStreamLogo({ style, compact = false }: InfinyStreamLogoProps) {
  const symbolSize = compact ? 28 : 36;

  return (
    <View style={[styles.row, style]}>
      <Svg width={symbolSize} height={symbolSize} viewBox="0 0 36 36">
        <Defs>
          <SvgGradient id="infinityGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={colors.gradientStart} />
            <Stop offset="100%" stopColor={colors.gradientEnd} />
          </SvgGradient>
        </Defs>
        <Path
          d="M12 18c0-3.3 2.7-6 6-6 2.2 0 4.1 1.2 5.2 3 1.1-1.8 3-3 5.2-3 3.3 0 6 2.7 6 6s-2.7 6-6 6c-2.2 0-4.1-1.2-5.2-3-1.1 1.8-3 3-5.2 3-3.3 0-6-2.7-6-6z"
          fill="none"
          stroke="url(#infinityGradient)"
          strokeWidth={2.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      {!compact && (
        <View>
          <Text style={styles.wordmark}>INFINY</Text>
          <Text style={styles.wordmarkAccent}>STREAM</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  wordmark: {
    ...typography.headline,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: colors.textPrimary,
    lineHeight: 18,
  },
  wordmarkAccent: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: colors.cyan,
    lineHeight: 14,
  },
});
