import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { groupEpisodesIntoSeries } from '@infiny-stream/shared';
import type { Channel } from '@infiny-stream/types';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { EmptyState } from '@/components/ui/EmptyState';
import { UniverseHeader } from '@/components/universe/UniverseHeader';
import { getAllChannelsByKind, getXtreamSeriesCatalog } from '@/services/channelsRepository';
import { isXtreamSeriesPlaceholder } from '@/services/persistChannels';

interface SeriesRow {
  id: string;
  title: string;
  logoUrl?: string;
  meta: string;
}

export default function SeriesUniverseScreen() {
  const [rows, setRows] = useState<SeriesRow[]>([]);
  const [unparsed, setUnparsed] = useState<Channel[]>([]);

  const reload = useCallback(async () => {
    const allSeries = await getAllChannelsByKind('series', 10000);
    const m3uRows = allSeries.filter(
      (c) => !c.xtreamSeriesId && !c.xtreamEpisodeId && !isXtreamSeriesPlaceholder(c.streamUrl)
    );
    const grouped = groupEpisodesIntoSeries(m3uRows);
    const xtreamCatalog = await getXtreamSeriesCatalog();

    const list: SeriesRow[] = [
      ...grouped.series.map((s) => ({
        id: s.id,
        title: s.title,
        logoUrl: s.logoUrl,
        meta: `${s.seasons.length} saison${s.seasons.length === 1 ? '' : 's'}`,
      })),
      ...xtreamCatalog.map((s) => ({
        id: s.id,
        title: s.name,
        logoUrl: s.logoUrl,
        meta:
          [s.genre, s.rating != null ? String(s.rating) : null, s.releaseDate?.slice(0, 4)].filter(Boolean).join(' · ') ||
          'Xtream',
      })),
    ];

    setRows(list);
    setUnparsed(grouped.unparsed);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const showEmpty = rows.length === 0 && unparsed.length === 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <UniverseHeader title="Séries" />

      {showEmpty ? (
        <EmptyState icon="albums-outline" title="Aucune série" message="Les séries de vos playlists apparaîtront ici." />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListFooterComponent={
            unparsed.length > 0 ? (
              <View style={styles.unparsedSection}>
                <Text style={styles.unparsedTitle}>Autres entrées séries</Text>
                <Text style={styles.unparsedHint}>Non regroupées en saisons — toujours disponibles.</Text>
                {unparsed.map((ch) => (
                  <Pressable key={ch.id} style={styles.unparsedRow} onPress={() => router.push(`/player/${ch.id}`)}>
                    <Text style={styles.unparsedName} numberOfLines={1}>
                      {ch.name}
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                  </Pressable>
                ))}
              </View>
            ) : null
          }
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={7}
          removeClippedSubviews
          renderItem={({ item }) => (
            <Pressable style={styles.seriesRow} onPress={() => router.push(`/universe/series/${item.id}`)}>
              <View style={styles.logoWrap}>
                {item.logoUrl ? (
                  <Image source={{ uri: item.logoUrl }} style={styles.logo} contentFit="contain" cachePolicy="disk" />
                ) : (
                  <Ionicons name="albums-outline" size={22} color={colors.textTertiary} />
                )}
              </View>
              <View style={styles.copy}>
                <Text style={styles.seriesTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.seriesMeta}>{item.meta}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxxl },
  seriesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  logoWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: { width: 40, height: 40 },
  copy: { flex: 1 },
  seriesTitle: { ...typography.bodyStrong, color: colors.textPrimary },
  seriesMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  unparsedSection: { marginTop: spacing.xl, gap: spacing.xs, paddingHorizontal: spacing.sm },
  unparsedTitle: { ...typography.headline, color: colors.textPrimary },
  unparsedHint: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm },
  unparsedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  unparsedName: { ...typography.body, color: colors.textPrimary, flex: 1 },
});
