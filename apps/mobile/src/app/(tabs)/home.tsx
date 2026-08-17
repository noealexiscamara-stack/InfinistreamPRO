import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Channel } from '@infiny-stream/types';
import { APP_NAME } from '@infiny-stream/config';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { NetworkStatusHeader } from '@/components/ui/NetworkStatusHeader';
import { ChannelRow } from '@/components/ui/ChannelRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { GlassCard } from '@/components/ui/GlassCard';
import { useSourcesStore } from '@/store/useSourcesStore';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import { useHistoryStore } from '@/store/useHistoryStore';
import { listFavoriteChannels } from '@/services/favoritesHistoryRepository';

export default function HomeScreen() {
  const sources = useSourcesStore((s) => s.sources);
  const loadSources = useSourcesStore((s) => s.load);
  const refreshSource = useSourcesStore((s) => s.refreshSource);
  const refreshingSourceId = useSourcesStore((s) => s.refreshingSourceId);
  const historyEntries = useHistoryStore((s) => s.entries);
  const loadHistory = useHistoryStore((s) => s.load);
  const toggleFavorite = useFavoritesStore((s) => s.toggle);
  const isFavorite = useFavoritesStore((s) => s.isFavorite);
  const [favoriteChannels, setFavoriteChannels] = useState<Channel[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const reload = useCallback(async () => {
    await Promise.all([loadHistory(), listFavoriteChannels(10).then(setFavoriteChannels)]);
  }, [loadHistory]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all(sources.map((s) => refreshSource(s.id).catch(() => undefined)));
    await reload();
    setRefreshing(false);
  }

  const hasAnySource = sources.length > 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.appName}>{APP_NAME}</Text>
          </View>
          <Pressable onPress={() => router.push('/add-source')} hitSlop={12}>
            <Ionicons name="add-circle-outline" size={28} color={colors.brand} />
          </Pressable>
        </View>

        <NetworkStatusHeader />

        {!hasAnySource && (
          <EmptyState
            icon="tv-outline"
            title="Aucune playlist pour le moment"
            message="Ajoutez une playlist M3U, un fichier, ou connectez-vous à un serveur Xtream Codes pour commencer."
            actionLabel="Ajouter une source"
            onAction={() => router.push('/add-source')}
          />
        )}

        {historyEntries.length > 0 && (
          <Section title="Continuer à regarder">
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={historyEntries}
              keyExtractor={(item) => item.channelId}
              contentContainerStyle={styles.hRowContent}
              renderItem={({ item }) => (
                <Pressable style={styles.historyTile} onPress={() => router.push(`/player/${item.channelId}`)}>
                  <GlassCard style={styles.historyCard}>
                    <Ionicons name="play-circle" size={22} color={colors.brand} />
                  </GlassCard>
                  <Text numberOfLines={1} style={styles.historyLabel}>
                    {item.channelName}
                  </Text>
                </Pressable>
              )}
            />
          </Section>
        )}

        {favoriteChannels.length > 0 && (
          <Section
            title="Favoris"
            action={{ label: 'Tout voir', onPress: () => router.push('/(tabs)/favorites') }}
          >
            {favoriteChannels.slice(0, 5).map((channel) => (
              <ChannelRow
                key={channel.id}
                channel={channel}
                isFavorite={isFavorite(channel.id)}
                onPress={() => router.push(`/player/${channel.id}`)}
                onToggleFavorite={() => toggleFavorite(channel.id, channel.sourceId)}
              />
            ))}
          </Section>
        )}

        {hasAnySource && (
          <Section title="Mes playlists" action={{ label: 'Gérer', onPress: () => router.push('/playlists') }}>
            {sources.map((source) => (
              <Pressable key={source.id} onPress={() => router.push(`/playlists/${source.id}`)}>
                <GlassCard style={styles.sourceRow}>
                  <View style={styles.sourceIcon}>
                    <Ionicons name="albums-outline" size={18} color={colors.brand} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sourceName}>{source.name}</Text>
                    <Text style={styles.sourceMeta}>
                      {refreshingSourceId === source.id
                        ? 'Actualisation…'
                        : source.lastError
                          ? source.lastError
                          : `${source.channelCount ?? 0} chaînes`}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                </GlassCard>
              </Pressable>
            ))}
          </Section>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: { label: string; onPress: () => void };
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {action && (
          <Pressable onPress={action.onPress}>
            <Text style={styles.sectionAction}>{action.label}</Text>
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing.xxxl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  appName: { ...typography.title, color: colors.textPrimary },
  section: { gap: spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { ...typography.headline, color: colors.textPrimary },
  sectionAction: { ...typography.caption, color: colors.brand },
  hRowContent: { gap: spacing.md },
  historyTile: { width: 96, gap: spacing.xs },
  historyCard: { width: 96, height: 64, alignItems: 'center', justifyContent: 'center', padding: 0 },
  historyLabel: { ...typography.caption, color: colors.textSecondary },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  sourceIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceName: { ...typography.bodyStrong, color: colors.textPrimary },
  sourceMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
});
