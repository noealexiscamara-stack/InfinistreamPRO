import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, spacing, typography } from '@/theme/tokens';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { useSourcesStore } from '@/store/useSourcesStore';
import { friendlyImportError } from '@/utils/friendlyErrors';
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
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const addM3uUrl = useSourcesStore((s) => s.addM3uUrl);

  const isLoading = progress !== null;
  const canSubmit = url.trim().length > 0 && /^https?:\/\//i.test(url.trim());

  async function handleSubmit() {
    setError(null);
    setProgress({ phase: 'downloading' });
    try {
      await addM3uUrl(name.trim() || 'Ma playlist', url.trim(), setProgress);
      router.replace('/(tabs)/home');
    } catch (err) {
      setError(friendlyImportError(err));
      setProgress(null);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Text style={styles.title}>URL M3U</Text>
      <Text style={styles.subtitle}>Collez le lien de votre playlist M3U.</Text>

      <View style={styles.form}>
        <TextField label="Nom (optionnel)" placeholder="Ma TV" value={name} onChangeText={setName} editable={!isLoading} />
        <TextField
          label="URL de la playlist"
          placeholder="https://…"
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          editable={!isLoading}
          error={error ?? undefined}
        />
      </View>

      {isLoading && <Text style={styles.progress}>{progressLabel(progress)}</Text>}

      <Button label="Ajouter" onPress={handleSubmit} disabled={!canSubmit} loading={isLoading} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.xl, paddingTop: spacing.xl, gap: spacing.lg },
  title: { ...typography.title, color: colors.textPrimary },
  subtitle: { ...typography.body, color: colors.textSecondary },
  form: { gap: spacing.md },
  progress: { ...typography.caption, color: colors.brand, textAlign: 'center' },
});
