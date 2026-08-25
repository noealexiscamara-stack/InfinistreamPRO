import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ScreenSafeArea } from '@/components/ui/ScreenSafeArea';
import { FormKeyboardScreen } from '@/components/ui/FormKeyboardScreen';
import { router } from 'expo-router';
import { colors, spacing, typography } from '@/theme/tokens';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { ImportErrorBanner } from '@/components/ui/ImportErrorBanner';
import { useSourcesStore } from '@/store/useSourcesStore';
import { describeImportError, type FriendlyImportErrorInfo } from '@/utils/friendlyErrors';
import { presentImportSummary } from '@/utils/presentImportSummary';
import type { XtreamImportProgress } from '@/services/xtream/importXtream';
import { xtreamImportProgressLabel } from '@/utils/xtreamImportProgress';
import { createThrottledCallback } from '@/utils/throttle';

export default function AddXtreamScreen() {
  const [name, setName] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<FriendlyImportErrorInfo | null>(null);
  const [progress, setProgress] = useState<XtreamImportProgress | null>(null);
  const addXtream = useSourcesStore((s) => s.addXtream);

  const isLoading = progress !== null;
  const canSubmit = serverUrl.trim().length > 0 && username.trim().length > 0 && password.length > 0;

  async function handleSubmit() {
    if (!canSubmit || isLoading) return;
    setError(null);
    setProgress({ phase: 'connecting', step: 'live' });
    const throttledProgress = createThrottledCallback((p: XtreamImportProgress) => setProgress(p), 1000);
    try {
      const result = await addXtream(
        name.trim() || 'Xtream',
        serverUrl.trim(),
        username.trim(),
        password,
        throttledProgress
      );
      throttledProgress.flush();
      presentImportSummary(result.summary, () => router.replace('/(tabs)/home'));
    } catch (err) {
      throttledProgress.flush();
      setError(describeImportError(err, { url: serverUrl.trim() }));
    } finally {
      setProgress(null);
    }
  }

  return (
    <ScreenSafeArea style={styles.safeArea}>
      <FormKeyboardScreen contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Connexion Xtream</Text>
        <Text style={styles.subtitle}>Renseignez les identifiants fournis par votre fournisseur Xtream Codes.</Text>

        <View style={styles.form}>
          <TextField label="Nom (optionnel)" placeholder="Mon abonnement" value={name} onChangeText={setName} editable={!isLoading} />
          <TextField
            label="URL du serveur"
            placeholder="http://serveur.exemple.com:8080"
            value={serverUrl}
            onChangeText={(value) => {
              setServerUrl(value);
              if (error) setError(null);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            editable={!isLoading}
          />
          <TextField
            label="Nom d'utilisateur"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isLoading}
          />
          <TextField label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry editable={!isLoading} />
        </View>

        {error && <ImportErrorBanner error={error} onRetry={handleSubmit} retryDisabled={isLoading || !canSubmit} />}

        {isLoading && progress && <Text style={styles.progress}>{xtreamImportProgressLabel(progress)}</Text>}

        <Button label="Se connecter" onPress={handleSubmit} disabled={!canSubmit || isLoading} loading={isLoading} />
      </FormKeyboardScreen>
    </ScreenSafeArea>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.xl },
  scrollContent: { paddingTop: spacing.xl, gap: spacing.lg },
  title: { ...typography.title, color: colors.textPrimary },
  subtitle: { ...typography.body, color: colors.textSecondary },
  form: { gap: spacing.md },
  progress: { ...typography.caption, color: colors.brand, textAlign: 'center' },
});
