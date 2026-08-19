import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export interface StartupFailureScreenProps {
  step: string;
  message: string;
  onRetry: () => void;
  onReset: () => void;
  isRetrying?: boolean;
}

const RESET_MESSAGE =
  'Cette action supprimera définitivement sur cet appareil :\n\n' +
  '• Vos playlists et chaînes importées\n' +
  '• Vos favoris\n' +
  '• Votre historique de lecture\n\n' +
  'Votre compte et vos identifiants ne seront pas effacés.';

export function StartupFailureScreen({
  step,
  message,
  onRetry,
  onReset,
  isRetrying = false,
}: StartupFailureScreenProps) {
  const confirmReset = () => {
    Alert.alert('Réinitialiser les données locales ?', RESET_MESSAGE, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Tout effacer', style: 'destructive', onPress: onReset },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.card}>
        <Text style={styles.title}>Le démarrage a échoué</Text>
        <Text style={styles.step}>Étape : {step}</Text>
        <Text style={styles.message}>{message}</Text>

        <Pressable
          style={[styles.button, styles.primaryButton, isRetrying && styles.buttonDisabled]}
          onPress={onRetry}
          disabled={isRetrying}
        >
          {isRetrying ? (
            <ActivityIndicator color={colors.textPrimary} />
          ) : (
            <Text style={styles.primaryLabel}>Réessayer</Text>
          )}
        </Pressable>

        <Pressable style={styles.resetLink} onPress={confirmReset} disabled={isRetrying}>
          <Text style={styles.resetLinkLabel}>Réinitialiser les données locales…</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { ...typography.headline, color: colors.textPrimary },
  step: { ...typography.caption, color: colors.cyan, textTransform: 'uppercase' },
  message: { ...typography.body, color: colors.textSecondary },
  button: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryButton: { backgroundColor: colors.brand },
  buttonDisabled: { opacity: 0.7 },
  primaryLabel: { ...typography.bodyStrong, color: colors.textPrimary },
  resetLink: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  resetLinkLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    textDecorationLine: 'underline',
  },
});
