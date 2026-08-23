import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ScreenSafeArea } from '@/components/ui/ScreenSafeArea';
import { router } from 'expo-router';
import { colors, spacing, typography } from '@/theme/tokens';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { ImportErrorBanner } from '@/components/ui/ImportErrorBanner';
import { useSourcesStore } from '@/store/useSourcesStore';
import { describeImportError, type FriendlyImportErrorInfo } from '@/utils/friendlyErrors';
import { presentImportSummary } from '@/utils/presentImportSummary';
import type { ImportProgress } from '@/services/m3u/importM3u';

function progressLabel(progress: ImportProgress | null): string {
  if (!progress) return '';
  if (progress.phase === 'downloading') return 'Téléchargement de la playlist…';
  if (progress.phase === 'parsing') return `Analyse en cours${progress.parsedCount ? ` (${progress.parsedCount} chaînes)` : '…'}`;
  return 'Enregistrement…';
}

export default function AddM3uUrlScreen() {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState<FriendlyImportErrorInfo | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const addM3uUrl = useSourcesStore((s) => s.addM3uUrl);

  const isLoading = progress !== null;
  const trimmedUrl = url.trim();
  const canSubmit = trimmedUrl.length > 0 && /^https?:\/\//i.test(trimmedUrl);

  async function handleSubmit() {
    if (!canSubmit) return;
    setError(null);
    setProgress({ phase: 'downloading' });
    try {
      const result = await addM3uUrl(name.trim() || 'Ma playlist', trimmedUrl, setProgress);
      presentImportSummary(result.summary, () => router.replace('/(tabs)/home'));
    } catch (err) {
      setError(describeImportError(err, { url: trimmedUrl }));
      setProgress(null);
    }
  }

  return (
    <ScreenSafeArea style={styles.safeArea}>
      <Text style={styles.title}>URL M3U</Text>
      <Text style={styles.subtitle}>Collez le lien de votre playlist M3U.</Text>

      <View style={styles.form}>
        <TextField label="Nom (optionnel)" placeholder="Ma TV" value={name} onChangeText={setName} editable={!isLoading} />
        <TextField
          label="URL de la playlist"
          placeholder="https://…"
          value={url}
          onChangeText={(value) => {
            setUrl(value);
            if (error) setError(null);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          editable={!isLoading}
        />
      </View>

      {error && <ImportErrorBanner error={error} onRetry={handleSubmit} retryDisabled={isLoading || !canSubmit} />}

      {isLoading && <Text style={styles.progress}>{progressLabel(progress)}</Text>}

      <Button label="Ajouter" onPress={handleSubmit} disabled={!canSubmit} loading={isLoading} />
    </ScreenSafeArea>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.xl, paddingTop: spacing.xl, gap: spacing.lg },
  title: { ...typography.title, color: colors.textPrimary },
  subtitle: { ...typography.body, color: colors.textSecondary },
  form: { gap: spacing.md },
  progress: { ...typography.caption, color: colors.brand, textAlign: 'center' },
});
