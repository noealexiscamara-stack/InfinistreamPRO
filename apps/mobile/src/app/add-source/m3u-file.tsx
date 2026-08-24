import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ScreenSafeArea } from '@/components/ui/ScreenSafeArea';
import { FormKeyboardScreen } from '@/components/ui/FormKeyboardScreen';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/theme/tokens';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { useSourcesStore } from '@/store/useSourcesStore';
import { describeImportError, type FriendlyImportErrorInfo } from '@/utils/friendlyErrors';
import { ImportErrorBanner } from '@/components/ui/ImportErrorBanner';
import { presentImportSummary } from '@/utils/presentImportSummary';
import type { ImportProgress } from '@/services/m3u/importM3u';

export default function AddM3uFileScreen() {
  const [name, setName] = useState('');
  const [pickedFile, setPickedFile] = useState<{ uri: string; name: string } | null>(null);
  const [error, setError] = useState<FriendlyImportErrorInfo | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const addM3uFile = useSourcesStore((s) => s.addM3uFile);

  const isLoading = progress !== null;

  async function pickFile() {
    setError(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/x-mpegurl', 'application/vnd.apple.mpegurl', 'text/plain', '*/*'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    setPickedFile({ uri: asset.uri, name: asset.name });
    if (!name) setName(asset.name.replace(/\.(m3u8?|txt)$/i, ''));
  }

  async function handleSubmit() {
    if (!pickedFile) return;
    setError(null);
    setProgress({ phase: 'downloading' });
    try {
      const result = await addM3uFile(name.trim() || pickedFile.name, pickedFile.uri, setProgress);
      presentImportSummary(result.summary, () => router.replace('/(tabs)/home'));
    } catch (err) {
      setError(describeImportError(err));
      setProgress(null);
    }
  }

  return (
    <ScreenSafeArea style={styles.safeArea}>
      <FormKeyboardScreen contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Fichier M3U</Text>
        <Text style={styles.subtitle}>Importez un fichier .m3u ou .m3u8 depuis votre appareil.</Text>

        <GlassCard style={styles.picker} onTouchEnd={pickFile}>
          <Ionicons name="cloud-upload-outline" size={28} color={colors.brand} />
          <Text style={styles.pickerLabel}>{pickedFile ? pickedFile.name : 'Choisir un fichier'}</Text>
        </GlassCard>

        <View style={styles.form}>
          <TextField label="Nom (optionnel)" placeholder="Ma TV" value={name} onChangeText={setName} editable={!isLoading} />
        </View>

        {error && <ImportErrorBanner error={error} onRetry={handleSubmit} retryDisabled={isLoading || !pickedFile} />}

        <Button label="Ajouter" onPress={handleSubmit} disabled={!pickedFile} loading={isLoading} />
      </FormKeyboardScreen>
    </ScreenSafeArea>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.xl },
  scrollContent: { paddingTop: spacing.xl, gap: spacing.lg },
  title: { ...typography.title, color: colors.textPrimary },
  subtitle: { ...typography.body, color: colors.textSecondary },
  picker: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl, borderStyle: 'dashed' as const },
  pickerLabel: { ...typography.bodyStrong, color: colors.textPrimary },
  form: { gap: spacing.md },
});
