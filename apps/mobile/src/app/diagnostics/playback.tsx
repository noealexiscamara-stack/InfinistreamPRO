import { useCallback, useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { ScreenSafeArea } from '@/components/ui/ScreenSafeArea';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  formatTimeToFailure,
  usePlaybackDiagnosticsStore,
  type PlaybackFailureRecord,
} from '@/store/usePlaybackDiagnosticsStore';

function FailureCard({ item }: { item: PlaybackFailureRecord }) {
  const when = useMemo(() => new Date(item.recordedAt).toLocaleString('fr-FR'), [item.recordedAt]);

  return (
    <View style={styles.card}>
      <Text style={styles.channelName} numberOfLines={2}>
        {item.channelName}
      </Text>
      <Meta label="Quand" value={when} />
      <Meta label="URL" value={item.streamUrl} mono />
      <Meta label="Code" value={item.errorCode ?? '—'} />
      <Meta label="Message" value={item.errorMessage} />
      <Meta label="Durée avant échec" value={formatTimeToFailure(item.timeToFailureMs)} />
      {!!item.rawErrorJson && (
        <View style={styles.rawBlock}>
          <Text style={styles.rawLabel}>Détail brut</Text>
          <Text style={styles.raw} selectable>
            {item.rawErrorJson}
          </Text>
        </View>
      )}
    </View>
  );
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={[styles.metaValue, mono && styles.mono]} selectable>
        {value}
      </Text>
    </View>
  );
}

export default function PlaybackDiagnosticsScreen() {
  const failures = usePlaybackDiagnosticsStore((s) => s.failures);
  const clear = usePlaybackDiagnosticsStore((s) => s.clear);

  const handleClear = useCallback(() => {
    clear();
  }, [clear]);

  return (
    <ScreenSafeArea style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Diagnostic lecture</Text>
        <Pressable onPress={handleClear} hitSlop={12} disabled={failures.length === 0}>
          <Text style={[styles.clear, failures.length === 0 && styles.clearDisabled]}>Effacer</Text>
        </Pressable>
      </View>

      <Text style={styles.hint}>
        Chaque échec ExoPlayer / expo-video est enregistré ici : code, message et délai avant panne.
      </Text>

      {failures.length === 0 ? (
        <EmptyState
          icon="bug-outline"
          title="Aucun échec enregistré"
          message="Lancez une chaîne qui refuse de démarrer (ex. RTI 1, RTG) pour capturer le code d'erreur."
        />
      ) : (
        <FlatList
          data={failures}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <FailureCard item={item} />}
        />
      )}
    </ScreenSafeArea>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  title: { ...typography.headline, color: colors.textPrimary, flex: 1, textAlign: 'center' },
  clear: { ...typography.bodyStrong, color: colors.brand },
  clearDisabled: { color: colors.textTertiary },
  hint: {
    ...typography.caption,
    color: colors.textSecondary,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  channelName: { ...typography.bodyStrong, color: colors.textPrimary },
  metaRow: { gap: 2 },
  metaLabel: { ...typography.label, color: colors.textTertiary, fontSize: 10 },
  metaValue: { ...typography.caption, color: colors.textSecondary },
  mono: { fontFamily: 'monospace', fontSize: 11 },
  rawBlock: {
    marginTop: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  rawLabel: { ...typography.label, color: colors.textTertiary, marginBottom: 4, fontSize: 10 },
  raw: { ...typography.caption, color: colors.textTertiary, fontFamily: 'monospace', fontSize: 10 },
});
