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
import { useStreamSessionStats } from '@/store/useStreamSessionStats';

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

function ConnectionSlotsCard() {
  const opened = useStreamSessionStats((s) => s.opened);
  const released = useStreamSessionStats((s) => s.released);
  const active = useStreamSessionStats((s) => s.active);
  const lastOpenUrl = useStreamSessionStats((s) => s.lastOpenUrl);
  const lastReleaseReason = useStreamSessionStats((s) => s.lastReleaseReason);
  const leak = active > 1;

  return (
    <View style={[styles.card, leak && styles.cardWarn]}>
      <Text style={styles.sectionTitle}>Connexions lecteur</Text>
      <Text style={styles.sectionHint}>
        Sans adb : si « Actives » dépasse 1 hors radio + TV simultanés, une source n&apos;a pas été libérée.
      </Text>
      <View style={styles.countersRow}>
        <Counter label="Ouvertes" value={opened} />
        <Counter label="Libérées" value={released} />
        <Counter label="Actives" value={active} warn={leak} />
      </View>
      {!!lastOpenUrl && <Meta label="Dernière ouverture" value={lastOpenUrl} mono />}
      {!!lastReleaseReason && <Meta label="Dernière libération" value={lastReleaseReason} />}
      {leak ? (
        <Text style={styles.warnText}>Attention : plus d&apos;une source active — risque de saturation fournisseur.</Text>
      ) : null}
    </View>
  );
}

function Counter({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <View style={styles.counter}>
      <Text style={[styles.counterValue, warn && styles.counterWarn]}>{value}</Text>
      <Text style={styles.counterLabel}>{label}</Text>
    </View>
  );
}

export default function PlaybackDiagnosticsScreen() {
  const failures = usePlaybackDiagnosticsStore((s) => s.failures);
  const clearFailures = usePlaybackDiagnosticsStore((s) => s.clear);
  const resetStats = useStreamSessionStats((s) => s.reset);

  const handleClear = useCallback(() => {
    clearFailures();
    resetStats();
  }, [clearFailures, resetStats]);

  return (
    <ScreenSafeArea style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Diagnostic lecture</Text>
        <Pressable onPress={handleClear} hitSlop={12}>
          <Text style={styles.clear}>Effacer</Text>
        </Pressable>
      </View>

      <Text style={styles.hint}>
        Compteurs de sources natives + chaque échec ExoPlayer / expo-video (code, message, délai).
      </Text>

      <View style={styles.listPad}>
        <ConnectionSlotsCard />
      </View>

      {failures.length === 0 ? (
        <EmptyState
          icon="bug-outline"
          title="Aucun échec enregistré"
          message="Lancez une chaîne qui refuse de démarrer pour capturer le code d'erreur. Les compteurs ci-dessus restent utiles même sans panne."
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
  hint: {
    ...typography.caption,
    color: colors.textSecondary,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  listPad: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cardWarn: { borderColor: colors.danger },
  sectionTitle: { ...typography.bodyStrong, color: colors.textPrimary },
  sectionHint: { ...typography.caption, color: colors.textSecondary },
  countersRow: { flexDirection: 'row', gap: spacing.md, marginVertical: spacing.xs },
  counter: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm },
  counterValue: { ...typography.title, color: colors.textPrimary },
  counterWarn: { color: colors.danger },
  counterLabel: { ...typography.caption, color: colors.textSecondary },
  warnText: { ...typography.caption, color: colors.danger },
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
