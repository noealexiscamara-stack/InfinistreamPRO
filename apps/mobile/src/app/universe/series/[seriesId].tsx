import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenSafeArea } from '@/components/ui/ScreenSafeArea';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { groupEpisodesIntoSeries } from '@infiny-stream/shared';
import type { Channel, GroupedSeries, XtreamSource } from '@infiny-stream/types';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { EmptyState } from '@/components/ui/EmptyState';
import { UniverseHeader } from '@/components/universe/UniverseHeader';
import {
  getAllChannelsByKind,
  getChannelById,
  getSeriesEpisodes,
} from '@/services/channelsRepository';
import { getSource } from '@/services/sourcesRepository';
import { isXtreamSeriesPlaceholder } from '@/services/persistChannels';
import { formatDisplayRating } from '@/services/xtream/mapXtreamCatalog';
import { loadXtreamSeriesInfo } from '@/services/xtream/xtreamSeriesService';

import {
  seriesPhaseAfterLoad,
  seriesPhaseOnFetchStart,
  type SeriesDetailPhase,
} from '@/app/universe/series/seriesDetailPhase';

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

  const [phase, setPhase] = useState<SeriesDetailPhase>(seriesPhaseOnFetchStart());
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

  const reload = useCallback(async () => {
    if (!id) {
      setPhase(seriesPhaseAfterLoad({ found: false, seasonCount: 0 }));
      return;
    }
    setPhase(seriesPhaseOnFetchStart());
    setSelectedSeason(null);

    try {
      const catalogRow = await getChannelById(id);
      if (catalogRow?.xtreamSeriesId) {
        // Load source from DB — never trust an empty in-memory store during boot.
        const source = (await getSource(catalogRow.sourceId)) as XtreamSource | null;
        if (!source || source.type !== 'xtream') {
          setPhase(seriesPhaseAfterLoad({ found: false, seasonCount: 0 }));
          return;
        }

        setTitle(catalogRow.name);
        setCoverUrl(catalogRow.logoUrl);
        setPlot(catalogRow.plot);
        setGenre(catalogRow.genre);
        setRatingLabel(formatDisplayRating(catalogRow.rating));

        const info = await loadXtreamSeriesInfo(source, catalogRow.xtreamSeriesId, catalogRow.name);
        if (info.cover) setCoverUrl(info.cover);
        if (info.plot) setPlot(info.plot);
        if (info.genre) setGenre(info.genre);

        const eps = await getSeriesEpisodes(source.id, catalogRow.xtreamSeriesId);
        const byEpisodeId = new Map(
          eps.filter((ep) => ep.xtreamEpisodeId).map((ep) => [ep.xtreamEpisodeId!, ep])
        );

        setXtreamSeasons(info.seasons);
        setXtreamEpisodes(info.episodes);
        setEpisodeChannelById(byEpisodeId);
        setSeasons([]);

        setPhase(
          seriesPhaseAfterLoad({
            found: true,
            seasonCount: info.seasons.length || (info.episodes.length > 0 ? 1 : 0),
          })
        );
        return;
      }

      const rows = await getAllChannelsByKind('series', 10000);
      const m3uRows = rows.filter(
        (c) => !c.xtreamSeriesId && !c.xtreamEpisodeId && !isXtreamSeriesPlaceholder(c.streamUrl)
      );
      const grouped = groupEpisodesIntoSeries(m3uRows);
      const series: GroupedSeries | undefined = grouped.series.find((s) => s.id === id);
      if (!series) {
        setPhase(seriesPhaseAfterLoad({ found: false, seasonCount: 0 }));
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
      setPhase(seriesPhaseAfterLoad({ found: true, seasonCount: m3uSeasons.length }));
    } catch {
      // Fetch failed — stay honest: only "missing" after the request finished empty/failed.
      setPhase(seriesPhaseAfterLoad({ found: false, seasonCount: 0 }));
    }
  }, [id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const seasonOptions = xtreamSeasons.length > 0 ? xtreamSeasons : seasons.map((s) => s.season);

  const episodeRows = useMemo((): EpisodeListItem[] => {
    if (selectedSeason == null) return [];
    if (xtreamSeasons.length > 0) {
      return xtreamEpisodes
        .filter((ep) => ep.season === selectedSeason)
        .flatMap((ep) => {
          const channel = episodeChannelById.get(ep.episodeId);
          if (!channel) return [];
          return [{ id: ep.episodeId, label: episodeLabel(ep), channelId: channel.id }];
        });
    }
    const eps = seasons.find((s) => s.season === selectedSeason)?.episodes ?? [];
    return eps.map((ch) => ({ id: ch.id, label: ch.name, channelId: ch.id }));
  }, [selectedSeason, xtreamSeasons.length, xtreamEpisodes, episodeChannelById, seasons]);

  const openSeason = (season: number) => {
    setSelectedSeason(season);
    setPhase('episodes');
  };

  const backFromEpisodes = () => {
    setSelectedSeason(null);
    setPhase('seasons');
  };

  return (
    <ScreenSafeArea style={styles.safeArea}>
      <UniverseHeader
        title={phase === 'episodes' && selectedSeason != null ? `Saison ${selectedSeason}` : title}
        onBack={phase === 'episodes' ? backFromEpisodes : undefined}
      />

      {phase === 'loading' ? (
        <View style={styles.skeleton} accessibilityLabel="Chargement de la série">
          <View style={styles.skeletonCover} />
          <View style={styles.skeletonCopy}>
            <View style={[styles.skeletonLine, { width: '70%' }]} />
            <View style={[styles.skeletonLine, { width: '45%' }]} />
            <View style={[styles.skeletonLine, { width: '90%' }]} />
            <View style={[styles.skeletonLine, { width: '85%' }]} />
          </View>
          <Text style={styles.loadingHint}>Chargement de la série…</Text>
        </View>
      ) : phase === 'missing' ? (
        <EmptyState
          icon="albums-outline"
          title="Série introuvable"
          message="Cette série n'est plus disponible."
        />
      ) : (
        <FlatList
          data={
            phase === 'episodes'
              ? episodeRows
              : seasonOptions.map((s) => ({ id: `season-${s}`, label: `Saison ${s}`, channelId: '', season: s }))
          }
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.header}>
              <View style={styles.coverRow}>
                {coverUrl ? (
                  <Image source={{ uri: coverUrl }} style={styles.cover} contentFit="cover" cachePolicy="disk" />
                ) : (
                  <View style={[styles.cover, styles.coverFallback]}>
                    <Ionicons name="albums-outline" size={36} color={colors.textTertiary} />
                  </View>
                )}
                <View style={styles.headerCopy}>
                  {ratingLabel ? <Text style={styles.rating}>{ratingLabel}</Text> : null}
                  {!!genre && <Text style={styles.genre}>{genre}</Text>}
                  {!!plot && (
                    <Text style={styles.plot} numberOfLines={6}>
                      {plot}
                    </Text>
                  )}
                </View>
              </View>
              {phase === 'seasons' ? (
                <Text style={styles.sectionHeading}>Saisons</Text>
              ) : (
                <Text style={styles.sectionHeading}>Épisodes</Text>
              )}
            </View>
          }
          ListEmptyComponent={
            phase === 'episodes' ? (
              <Text style={styles.emptyEpisodes}>Aucun épisode dans cette saison.</Text>
            ) : null
          }
          renderItem={({ item }) => {
            if (phase === 'seasons') {
              const season = (item as EpisodeListItem & { season: number }).season;
              const count =
                xtreamSeasons.length > 0
                  ? xtreamEpisodes.filter((ep) => ep.season === season).length
                  : (seasons.find((s) => s.season === season)?.episodes.length ?? 0);
              return (
                <Pressable style={styles.row} onPress={() => openSeason(season)}>
                  <Text style={styles.rowTitle}>Saison {season}</Text>
                  <Text style={styles.rowMeta}>{count} épisodes</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                </Pressable>
              );
            }
            return (
              <Pressable style={styles.row} onPress={() => router.push(`/player/${item.channelId}`)}>
                <Text style={styles.rowTitle} numberOfLines={2}>
                  {item.label}
                </Text>
                <Text style={styles.playLabel}>Lire</Text>
              </Pressable>
            );
          }}
        />
      )}
    </ScreenSafeArea>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  skeleton: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  skeletonCover: {
    width: 120,
    aspectRatio: 2 / 3,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  skeletonCopy: { gap: spacing.sm },
  skeletonLine: {
    height: 14,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  loadingHint: { ...typography.body, color: colors.textSecondary, marginTop: spacing.md },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxxl, gap: spacing.xs },
  header: { gap: spacing.md, marginBottom: spacing.md },
  coverRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  cover: {
    width: 120,
    aspectRatio: 2 / 3,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  coverFallback: { alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, gap: spacing.xs },
  rating: { ...typography.caption, color: colors.cyan, fontWeight: '700' },
  genre: { ...typography.caption, color: colors.cyan, textTransform: 'uppercase' },
  plot: { ...typography.body, color: colors.textSecondary },
  sectionHeading: { ...typography.headline, color: colors.textPrimary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  rowTitle: { ...typography.body, color: colors.textPrimary, flex: 1 },
  rowMeta: { ...typography.caption, color: colors.textSecondary },
  playLabel: { ...typography.caption, color: colors.cyan, fontWeight: '600' },
  emptyEpisodes: { ...typography.body, color: colors.textSecondary, padding: spacing.lg },
});
