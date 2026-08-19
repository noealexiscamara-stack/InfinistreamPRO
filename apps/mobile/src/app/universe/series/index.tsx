import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
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
import { formatDisplayRating } from '@/services/xtream/mapXtreamCatalog';

interface SeriesRow {
  id: string;
  title: string;
  logoUrl?: string;
  ratingLabel: string | null;
}

export default function SeriesUniverseScreen() {
  const { width } = useWindowDimensions();
  const numColumns = useMemo(() => (width >= 1200 ? 5 : width >= 900 ? 4 : width >= 600 ? 3 : 2), [width]);
  const tileWidth = (width - spacing.md * 2 - spacing.sm * (numColumns - 1)) / numColumns;

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
        ratingLabel: null,
      })),
      ...xtreamCatalog.map((s) => ({
        id: s.id,
        title: s.name,
        logoUrl: s.logoUrl,
        ratingLabel: formatDisplayRating(s.rating),
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
          numColumns={numColumns}
          key={numColumns}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={numColumns > 1 ? styles.row : undefined}
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
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={7}
          removeClippedSubviews
          renderItem={({ item }) => (
            <Pressable
              style={[styles.tile, { width: tileWidth }]}
              onPress={() => router.push(`/universe/series/${item.id}`)}
            >
              <View style={styles.coverWrap}>
                {item.logoUrl ? (
                  <Image source={{ uri: item.logoUrl }} style={styles.cover} contentFit="cover" cachePolicy="disk" />
                ) : (
                  <Ionicons name="albums-outline" size={28} color={colors.textTertiary} />
                )}
                {item.ratingLabel ? (
                  <View style={styles.ratingBadge}>
                    <Ionicons name="star" size={11} color={colors.background} />
                    <Text style={styles.ratingText}>{item.ratingLabel}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.tileTitle} numberOfLines={2}>
                {item.title}
              </Text>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  grid: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxxl, gap: spacing.sm },
  row: { gap: spacing.sm },
  tile: { marginBottom: spacing.md },
  coverWrap: {
    aspectRatio: 2 / 3,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cover: { width: '100%', height: '100%' },
  ratingBadge: {
    position: 'absolute',
    bottom: spacing.xs,
    right: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  ratingText: { ...typography.label, color: colors.textPrimary, fontWeight: '700' },
  tileTitle: { ...typography.caption, color: colors.textPrimary, marginTop: spacing.xs },
  unparsedSection: { marginTop: spacing.xl, gap: spacing.xs, width: '100%' },
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
