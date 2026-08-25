import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { ScreenSafeArea } from '@/components/ui/ScreenSafeArea';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { groupEpisodesIntoSeries } from '@infiny-stream/shared';
import type { Channel, ChannelCategory } from '@infiny-stream/types';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { EmptyState } from '@/components/ui/EmptyState';
import { UniverseHeader } from '@/components/universe/UniverseHeader';
import { CategoryBrowser } from '@/components/universe/CategoryBrowser';
import {
  getAllChannelsByKind,
  getKindCounts,
  getXtreamSeriesCatalog,
  getXtreamSeriesCategories,
} from '@/services/channelsRepository';
import { isXtreamSeriesPlaceholder } from '@/services/persistChannels';
import { formatDisplayRating } from '@/services/xtream/mapXtreamCatalog';

const PAGE_SIZE = 120;
const UNPARSED_PREVIEW = 30;

interface SeriesRow {
  id: string;
  title: string;
  logoUrl?: string;
  ratingLabel: string | null;
}

type BrowseMode = 'categories' | 'grid';

function m3uSeriesRows(channels: Channel[]): SeriesRow[] {
  const candidates = channels.filter(
    (c) => !c.xtreamSeriesId && !c.xtreamEpisodeId && !isXtreamSeriesPlaceholder(c.streamUrl)
  );
  const grouped = groupEpisodesIntoSeries(candidates);
  return grouped.series.map((s) => ({
    id: s.id,
    title: s.title,
    logoUrl: s.logoUrl,
    ratingLabel: null,
  }));
}

function xtreamSeriesRows(channels: Channel[]): SeriesRow[] {
  return channels.map((s) => ({
    id: s.id,
    title: s.name,
    logoUrl: s.logoUrl,
    ratingLabel: formatDisplayRating(s.rating),
  }));
}

export default function SeriesUniverseScreen() {
  const { width } = useWindowDimensions();
  const numColumns = useMemo(() => (width >= 1200 ? 5 : width >= 900 ? 4 : width >= 600 ? 3 : 2), [width]);
  const tileWidth = (width - spacing.md * 2 - spacing.sm * (numColumns - 1)) / numColumns;

  const [mode, setMode] = useState<BrowseMode>('categories');
  const [categories, setCategories] = useState<ChannelCategory[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [languageFilter, setLanguageFilter] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ChannelCategory | null>(null);

  const [rows, setRows] = useState<SeriesRow[]>([]);
  const [unparsed, setUnparsed] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const xtreamOffsetRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const categoryNameRef = useRef<string | null>(null);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const [cats, counts] = await Promise.all([getXtreamSeriesCategories(), getKindCounts()]);
      setCategories(cats);
      setTotalCount(counts.series);
      console.log(`[Universe] series categories=${cats.length} total=${counts.series}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadInitialGrid = useCallback(async (categoryName: string | null) => {
    setLoading(true);
    loadingMoreRef.current = false;
    xtreamOffsetRef.current = 0;
    categoryNameRef.current = categoryName;
    try {
      // M3U series only on "all" — category filter is Xtream category_name based.
      const [m3uPage, xtreamPage] = await Promise.all([
        categoryName
          ? Promise.resolve([] as Channel[])
          : getAllChannelsByKind('series', PAGE_SIZE, 0),
        getXtreamSeriesCatalog(PAGE_SIZE, 0, categoryName),
      ]);

      const m3uCandidates = m3uPage.filter(
        (c) => !c.xtreamSeriesId && !c.xtreamEpisodeId && !isXtreamSeriesPlaceholder(c.streamUrl)
      );
      const grouped = groupEpisodesIntoSeries(m3uCandidates);

      xtreamOffsetRef.current = xtreamPage.length;
      setRows([...m3uSeriesRows(m3uPage), ...xtreamSeriesRows(xtreamPage)]);
      setUnparsed(categoryName ? [] : grouped.unparsed);
      setHasMore(xtreamPage.length === PAGE_SIZE);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMore || loading) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const offset = xtreamOffsetRef.current;
      const xtreamPage = await getXtreamSeriesCatalog(PAGE_SIZE, offset, categoryNameRef.current);
      xtreamOffsetRef.current = offset + xtreamPage.length;
      setRows((prev) => [...prev, ...xtreamSeriesRows(xtreamPage)]);
      setHasMore(xtreamPage.length === PAGE_SIZE);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [hasMore, loading]);

  useEffect(() => {
    if (mode === 'categories') {
      void loadCategories();
    }
  }, [mode, loadCategories]);

  const openGrid = (category: ChannelCategory | null) => {
    setSelectedCategory(category);
    setMode('grid');
    setRows([]);
    setUnparsed([]);
    void loadInitialGrid(category?.name ?? null);
  };

  const backToCategories = () => {
    setMode('categories');
    setSelectedCategory(null);
    setRows([]);
    setUnparsed([]);
  };

  const unparsedPreview = unparsed.slice(0, UNPARSED_PREVIEW);
  const unparsedRemaining = Math.max(0, unparsed.length - UNPARSED_PREVIEW);
  const showEmpty = !loading && rows.length === 0 && unparsed.length === 0;
  const headerTitle =
    mode === 'categories' ? 'Séries' : selectedCategory?.name ?? 'Toutes les séries';

  return (
    <ScreenSafeArea style={styles.safeArea}>
      <UniverseHeader
        title={headerTitle}
        onBack={mode === 'grid' ? backToCategories : undefined}
      />

      {mode === 'categories' ? (
        loading ? (
          <ActivityIndicator color={colors.brand} style={styles.loader} />
        ) : categories.length === 0 && totalCount === 0 ? (
          <EmptyState
            icon="albums-outline"
            title="Aucune série"
            message="Les séries de vos playlists apparaîtront ici."
          />
        ) : categories.length === 0 ? (
          <EmptyState
            icon="albums-outline"
            title="Aucune catégorie"
            message="Les séries n'ont pas de catégorie — affichez-les toutes."
            actionLabel="Voir toutes les séries"
            onAction={() => openGrid(null)}
          />
        ) : (
          <CategoryBrowser
            categories={categories}
            languageFilter={languageFilter}
            onSelectLanguage={setLanguageFilter}
            onSelectCategory={(cat) => openGrid(cat)}
            onSelectAll={() => openGrid(null)}
            totalCount={totalCount}
          />
        )
      ) : loading ? (
        <ActivityIndicator color={colors.brand} style={styles.loader} />
      ) : showEmpty ? (
        <EmptyState
          icon="albums-outline"
          title="Aucune série"
          message="Les séries de vos playlists apparaîtront ici."
        />
      ) : (
        <FlatList
          data={rows}
          numColumns={numColumns}
          key={numColumns}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={numColumns > 1 ? styles.row : undefined}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={7}
          removeClippedSubviews
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            <>
              {loadingMore ? <ActivityIndicator color={colors.brand} style={styles.loader} /> : null}
              {unparsedPreview.length > 0 ? (
                <View style={styles.unparsedSection}>
                  <Text style={styles.unparsedTitle}>Autres entrées séries</Text>
                  <Text style={styles.unparsedHint}>Non regroupées en saisons — toujours disponibles.</Text>
                  {unparsedPreview.map((ch) => (
                    <Pressable key={ch.id} style={styles.unparsedRow} onPress={() => router.push(`/player/${ch.id}`)}>
                      <Text style={styles.unparsedName} numberOfLines={1}>
                        {ch.name}
                      </Text>
                      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                    </Pressable>
                  ))}
                  {unparsedRemaining > 0 ? (
                    <Text style={styles.unparsedHint}>… et {unparsedRemaining.toLocaleString('fr-FR')} autres</Text>
                  ) : null}
                </View>
              ) : null}
            </>
          }
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
    </ScreenSafeArea>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  loader: { paddingVertical: spacing.lg },
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
