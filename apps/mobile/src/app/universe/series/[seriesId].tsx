import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
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
import { formatDisplayRating } from '@/services/xtream/mapXtreamCatalog';
import { loadXtreamSeriesInfo } from '@/services/xtream/xtreamSeriesService';
import { useSourcesStore } from '@/store/useSourcesStore';
import type { XtreamSource } from '@infiny-stream/types';

interface EpisodeListItem {
  id: string;
  label: string;
  channelId: string;
}

interface XtreamEpisodeRow {
  episodeId: string;
  season: number;
  episode: number;
  title: string;
}

function episodeLabel(ep: XtreamEpisodeRow): string {
  const marker = `S${String(ep.season).padStart(2, '0')}E${String(ep.episode).padStart(2, '0')}`;
  return ep.title ? `${marker} — ${ep.title}` : marker;
}

export default function SeriesDetailScreen() {
  const { seriesId } = useLocalSearchParams<{ seriesId: string }>();
  const id = Array.isArray(seriesId) ? seriesId[0] : seriesId;
  const sources = useSourcesStore((s) => s.sources);

  const [title, setTitle] = useState('Série');
  const [coverUrl, setCoverUrl] = useState<string | undefined>();
  const [plot, setPlot] = useState<string | undefined>();
  const [genre, setGenre] = useState<string | undefined>();
  const [ratingLabel, setRatingLabel] = useState<string | null>(null);
  const [seasons, setSeasons] = useState<{ season: number; episodes: Channel[] }[]>([]);
  const [xtreamSeasons, setXtreamSeasons] = useState<number[]>([]);
  const [xtreamEpisodes, setXtreamEpisodes] = useState<XtreamEpisodeRow[]>([]);
  const [episodeChannelById, setEpisodeChannelById] = useState<Map<string, Channel>>(new Map());
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  const visibleXtreamEpisodes = useMemo(() => {
    if (selectedSeason == null) return [];
    return xtreamEpisodes.filter((ep) => ep.season === selectedSeason);
  }, [selectedSeason, xtreamEpisodes]);

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
      setCoverUrl(catalogRow.logoUrl);
      setPlot(catalogRow.plot);
      setGenre(catalogRow.genre);
      setRatingLabel(formatDisplayRating(catalogRow.rating));
      try {
        const info = await loadXtreamSeriesInfo(source, catalogRow.xtreamSeriesId, catalogRow.name);
        if (info.cover) setCoverUrl(info.cover);
        if (info.plot) setPlot(info.plot);
        if (info.genre) setGenre(info.genre);

        const eps = await getSeriesEpisodes(source.id, catalogRow.xtreamSeriesId);
        const byEpisodeId = new Map(eps.filter((ep) => ep.xtreamEpisodeId).map((ep) => [ep.xtreamEpisodeId!, ep]));

        setXtreamSeasons(info.seasons);
        setXtreamEpisodes(info.episodes);
        setEpisodeChannelById(byEpisodeId);
        setSelectedSeason(info.seasons[0] ?? null);
        setSeasons([]);
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
    setCoverUrl(series.logoUrl);
    setPlot(undefined);
    setGenre(undefined);
    setRatingLabel(null);
    setXtreamSeasons([]);
    setXtreamEpisodes([]);
    setEpisodeChannelById(new Map());
    const m3uSeasons = series.seasons.map((s) => ({ season: s.season, episodes: s.episodes }));
    setSeasons(m3uSeasons);
    setSelectedSeason(m3uSeasons[0]?.season ?? null);
    setLoading(false);
  }, [id, sources]);

  useEffect(() => {
    reload();
  }, [reload]);

  const m3uVisibleEpisodes = useMemo(() => {
    if (selectedSeason == null) return [];
    return seasons.find((s) => s.season === selectedSeason)?.episodes ?? [];
  }, [seasons, selectedSeason]);

  const episodeRows = useMemo((): EpisodeListItem[] => {
    if (xtreamSeasons.length > 0) {
      return visibleXtreamEpisodes.flatMap((ep) => {
        const channel = episodeChannelById.get(ep.episodeId);
        if (!channel) return [];
        return [{ id: ep.episodeId, label: episodeLabel(ep), channelId: channel.id }];
      });
    }
    return m3uVisibleEpisodes.map((ch) => ({ id: ch.id, label: ch.name, channelId: ch.id }));
  }, [xtreamSeasons.length, visibleXtreamEpisodes, m3uVisibleEpisodes, episodeChannelById]);

  const seasonOptions = xtreamSeasons.length > 0 ? xtreamSeasons : seasons.map((s) => s.season);

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
          data={episodeRows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.header}>
              {coverUrl ? (
                <Image source={{ uri: coverUrl }} style={styles.cover} contentFit="cover" cachePolicy="disk" />
              ) : null}
              <View style={styles.headerCopy}>
                {ratingLabel ? <Text style={styles.rating}>{ratingLabel}</Text> : null}
                {!!genre && <Text style={styles.genre}>{genre}</Text>}
                {!!plot && <Text style={styles.plot}>{plot}</Text>}
              </View>
              {seasonOptions.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.seasonPicker}>
                  {seasonOptions.map((season) => {
                    const selected = season === selectedSeason;
                    return (
                      <Pressable
                        key={season}
                        style={[styles.seasonChip, selected && styles.seasonChipSelected]}
                        onPress={() => setSelectedSeason(season)}
                      >
                        <Text style={[styles.seasonChipLabel, selected && styles.seasonChipLabelSelected]}>
                          Saison {season}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : null}
              {selectedSeason != null ? (
                <Text style={styles.episodeHeading}>Épisodes — Saison {selectedSeason}</Text>
              ) : null}
            </View>
          }
          renderItem={({ item }) => (
            <Pressable style={styles.episodeRow} onPress={() => router.push(`/player/${item.channelId}`)}>
              <Text style={styles.episodeName} numberOfLines={2}>
                {item.label}
              </Text>
              <Text style={styles.playLabel}>Lire</Text>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxxl, gap: spacing.xs },
  header: { gap: spacing.md, marginBottom: spacing.md },
  cover: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  headerCopy: { gap: spacing.xs },
  rating: { ...typography.caption, color: colors.cyan, fontWeight: '700' },
  genre: { ...typography.caption, color: colors.cyan, textTransform: 'uppercase' },
  plot: { ...typography.body, color: colors.textSecondary },
  seasonPicker: { gap: spacing.sm, paddingVertical: spacing.xs },
  seasonChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  seasonChipSelected: { backgroundColor: colors.cyan },
  seasonChipLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  seasonChipLabelSelected: { color: colors.background },
  episodeHeading: { ...typography.headline, color: colors.textPrimary },
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
