import { useEffect } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Source } from '@infiny-stream/types';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { GlassCard } from '@/components/ui/GlassCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { useSourcesStore } from '@/store/useSourcesStore';

function sourceTypeLabel(type: Source['type']): string {
  switch (type) {
    case 'm3u_url':
      return 'URL M3U';
    case 'm3u_file':
      return 'Fichier M3U';
    case 'xtream':
      return 'Xtream Codes';
    case 'direct_stream':
      return 'Lien direct';
  }
}

export default function PlaylistsScreen() {
  const sources = useSourcesStore((s) => s.sources);
  const load = useSourcesStore((s) => s.load);
  const refreshSource = useSourcesStore((s) => s.refreshSource);
  const removeSource = useSourcesStore((s) => s.removeSource);
  const refreshingSourceId = useSourcesStore((s) => s.refreshingSourceId);

  useEffect(() => {
    load();
  }, [load]);

  function confirmDelete(source: Source) {
    Alert.alert('Supprimer la playlist', `Supprimer « ${source.name} » et toutes ses chaînes ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => removeSource(source.id) },
    ]);
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Mes playlists</Text>
        <Pressable onPress={() => router.push('/add-source')} hitSlop={12}>
          <Ionicons name="add-circle-outline" size={26} color={colors.brand} />
        </Pressable>
      </View>

      {sources.length === 0 ? (
        <EmptyState
          icon="albums-outline"
          title="Aucune playlist"
          message="Ajoutez votre première source pour commencer."
          actionLabel="Ajouter une source"
          onAction={() => router.push('/add-source')}
        />
      ) : (
        <FlatList
          data={sources}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <GlassCard style={styles.card}>
              <Pressable style={styles.cardMain} onPress={() => router.push(`/playlists/${item.id}`)}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>
                  {sourceTypeLabel(item.type)} · {item.channelCount ?? 0} chaînes
                  {item.lastError ? ` · ${item.lastError}` : ''}
                </Text>
              </Pressable>
              <View style={styles.actions}>
                <Pressable
                  hitSlop={10}
                  onPress={() => refreshSource(item.id)}
                  disabled={refreshingSourceId === item.id}
                  style={styles.actionButton}
                >
                  <Ionicons
                    name="refresh"
                    size={18}
                    color={refreshingSourceId === item.id ? colors.textTertiary : colors.textSecondary}
                  />
                </Pressable>
                <Pressable hitSlop={10} onPress={() => confirmDelete(item)} style={styles.actionButton}>
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                </Pressable>
              </View>
            </GlassCard>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  title: { ...typography.title, color: colors.textPrimary },
  list: { paddingHorizontal: spacing.xl, gap: spacing.md, paddingBottom: spacing.xxxl },
  card: { flexDirection: 'row', alignItems: 'center' },
  cardMain: { flex: 1 },
  name: { ...typography.bodyStrong, color: colors.textPrimary },
  meta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  actions: { flexDirection: 'row', gap: spacing.xs },
  actionButton: { padding: spacing.sm, borderRadius: radius.sm },
});
