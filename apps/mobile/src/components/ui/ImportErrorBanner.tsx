import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { Button } from '@/components/ui/Button';
import type { FriendlyImportErrorInfo } from '@/utils/friendlyErrors';

interface ImportErrorBannerProps {
  error: FriendlyImportErrorInfo;
  onRetry: () => void;
  retryDisabled?: boolean;
}

export function ImportErrorBanner({ error, onRetry, retryDisabled }: ImportErrorBannerProps) {
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <View style={styles.header}>
        <Ionicons name="alert-circle" size={22} color={colors.danger} />
        <View style={styles.copy}>
          <Text style={styles.title}>{error.title}</Text>
          <Text style={styles.cause}>{error.cause}</Text>
        </View>
      </View>
      <Button label="Réessayer" variant="secondary" onPress={onRetry} disabled={retryDisabled} />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  cause: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
