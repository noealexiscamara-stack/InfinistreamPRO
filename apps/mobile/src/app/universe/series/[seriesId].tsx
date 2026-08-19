import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { groupEpisodesIntoSeries } from '@infiny-stream/shared';
import type { Channel, GroupedSeries } from '@infiny-stream/types';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { EmptyState } from '@/components/ui/EmptyState';
import { UniverseHeader } from '@/components/universe/UniverseHeader';
import {
  getAllChannelsByKind,
  getChannelById,
  getSeriesEpisodes,
} from '@/services/channelsRepository';
import { isXtreamSeriesPlaceholder } from '@/services/persistChannels';
import { loadXtreamSeriesInfo } from '@/services/xtream/xtreamSeriesService';
import { useSourcesStore } from '@/store/useSourcesStore';
import type { XtreamSource } from '@infiny-stream/types';

interface SeasonBlock {
  season: number;
  episodes: Channel[];
}

export default function SeriesDetailScreen() {
  const { seriesId } = useLocalSearchParams<{ seriesId: string }>();
  const id = Array.isArray(seriesId) ? seriesId[0] : seriesId;
  const sources = useSourcesStore((s) => s.sources);

  const [title, setTitle] = useState('Série');
  const [plot, setPlot] = useState<string | undefined>();
  const [genre, setGenre] = useState<string | undefined>();
  const [seasons, setSeasons] = useState<SeasonBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  const reload = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setMissing(false);

    const catalogRow = await getChannelById(id);
    if (catalogRow?.xtreamSeriesId) {
      const source = sources.find((s) => s.id === catalogRow.sourceId && s.type === 'xtream') as XtreamSource | undefined;
      if (!source) {
        setMissing(true);
        setLoading(false);
        return;
      }
      setTitle(catalogRow.name);
      setPlot(catalogRow.plot);
      setGenre(catalogRow.genre);
      try {
        const info = await loadXtreamSeriesInfo(source, catalogRow.xtreamSeriesId, catalogRow.name);
        if (info.plot) setPlot(info.plot);
        if (info.genre) setGenre(info.genre);
        const bySeason = new Map<number, Channel[]>();
        const eps = await getSeriesEpisodes(source.id, catalogRow.xtreamSeriesId);
        for (const ep of eps) {
          const match = ep.name.match(/S(\d+)E(\d+)/i);
          const season = match ? Number(match[1]) : 0;
          if (!bySeason.has(season)) bySeason.set(season, []);
          bySeason.get(season)!.push(ep);
        }
        setSeasons(
          [...bySeason.entries()]
            .sort(([a], [b]) => a - b)
            .map(([season, episodes]) => ({ season, episodes }))
        );
      } catch {
        setMissing(true);
      }
      setLoading(false);
      return;
    }

    const rows = await getAllChannelsByKind('series', 10000);
    const m3uRows = rows.filter(
      (c) => !c.xtreamSeriesId && !c.xtreamEpisodeId && !isXtreamSeriesPlaceholder(c.streamUrl)
    );
    const grouped = groupEpisodesIntoSeries(m3uRows);
    const series: GroupedSeries | undefined = grouped.series.find((s) => s.id === id);
    if (!series) {
      setMissing(true);
      setLoading(false);
      return;
    }
    setTitle(series.title);
    setPlot(undefined);
    setGenre(undefined);
    setSeasons(series.seasons.map((s) => ({ season: s.season, episodes: s.episodes })));
    setLoading(false);
  }, [id, sources]);

  useEffect(() => {
    reload();
  }, [reload]);

  const headerMeta = useMemo(() => [genre, plot].filter(Boolean).join('\n'), [genre, plot]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <UniverseHeader title={title} />

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.cyan} />
        </View>
      ) : missing ? (
        <EmptyState icon="albums-outline" title="Série introuvable" message="Cette série n'est plus disponible." />
      ) : (
        <FlatList
          data={seasons}
          keyExtractor={(item) => String(item.season)}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            headerMeta ? (
              <View style={styles.headerCopy}>
                {!!genre && <Text style={styles.genre}>{genre}</Text>}
                {!!plot && <Text style={styles.plot}>{plot}</Text>}
              </View>
            ) : null
          }
          renderItem={({ item: season }) => (
            <View style={styles.seasonBlock}>
              <Text style={styles.seasonTitle}>Saison {season.season}</Text>
              {season.episodes.map((ep) => (
                <Pressable key={ep.id} style={styles.episodeRow} onPress={() => router.push(`/player/${ep.id}`)}>
                  <Text style={styles.episodeName} numberOfLines={1}>
                    {ep.name}
                  </Text>
                  <Text style={styles.playLabel}>Lire</Text>
                </Pressable>
              ))}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxxl, gap: spacing.lg },
  headerCopy: { gap: spacing.xs, marginBottom: spacing.md },
  genre: { ...typography.caption, color: colors.cyan, textTransform: 'uppercase' },
  plot: { ...typography.body, color: colors.textSecondary },
  seasonBlock: { gap: spacing.xs },
  seasonTitle: { ...typography.headline, color: colors.textPrimary, marginBottom: spacing.xs },
  episodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  episodeName: { ...typography.body, color: colors.textPrimary, flex: 1, marginRight: spacing.md },
  playLabel: { ...typography.caption, color: colors.cyan, fontWeight: '600' },
});
