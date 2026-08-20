import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme/tokens';

interface WelcomeTitleProps {
  scale?: number;
}

export function WelcomeTitle({ scale = 1 }: WelcomeTitleProps) {
  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { fontSize: Math.round(26 * scale) }]}>Bienvenue sur Infiny Stream</Text>
      <Text style={[styles.subtitle, { fontSize: Math.round(15 * scale) }]}>
        Votre lecteur IPTV intelligent et fluide.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  title: { ...typography.hero, color: colors.textPrimary },
  subtitle: { ...typography.body, color: colors.textSecondary },
});
