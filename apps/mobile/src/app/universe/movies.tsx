import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { ScreenSafeArea } from '@/components/ui/ScreenSafeArea';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { Channel, ChannelCategory } from '@infiny-stream/types';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { EmptyState } from '@/components/ui/EmptyState';
import { UniverseHeader } from '@/components/universe/UniverseHeader';
import { CategoryBrowser } from '@/components/universe/CategoryBrowser';
import {
  countChannels,
  getAllCategoriesByKind,
  getAllChannelsByKindAndCategory,
} from '@/services/channelsRepository';
import { formatDisplayRating } from '@/services/xtream/mapXtreamCatalog';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import { useSourcesStore } from '@/store/useSourcesStore';
import { useParentalStore } from '@/store/useParentalStore';
import { posterGridColumns, posterTileWidth } from '@/utils/posterGrid';

const PAGE_SIZE = 120;

type BrowseMode = 'categories' | 'grid';

export default function MoviesUniverseScreen() {
  const { width } = useWindowDimensions();
  const numColumns = useMemo(() => posterGridColumns(width), [width]);
  const tileWidth = posterTileWidth(width, numColumns);
  const unlocked = useParentalStore((s) => s.unlocked);
  const pinConfigured = useParentalStore((s) => s.pinConfigured);
  const includeAdult = pinConfigured && unlocked;

  const [mode, setMode] = useState<BrowseMode>('categories');
  const [categories, setCategories] = useState<ChannelCategory[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [languageFilter, setLanguageFilter] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ChannelCategory | null>(null);

  const [movies, setMovies] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const loadedCountRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const categoryNameRef = useRef<string | null>(null);

  const hasXtreamSource = useSourcesStore((s) => s.sources.some((src) => src.type === 'xtream'));
  const toggleFavorite = useFavoritesStore((s) => s.toggle);
  const isFavorite = useFavoritesStore((s) => s.isFavorite);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const [cats, total] = await Promise.all([
        getAllCategoriesByKind('movie', includeAdult),
        countChannels({ kind: 'movie', includeAdult }),
      ]);
      setCategories(cats);
      setTotalCount(total);
      console.log(`[Universe] movie categories=${cats.length} total=${total}`);
    } finally {
      setLoading(false);
    }
  }, [includeAdult]);

  const loadInitialGrid = useCallback(async (categoryName: string | null) => {
    setLoading(true);
    loadingMoreRef.current = false;
    loadedCountRef.current = 0;
    categoryNameRef.current = categoryName;
    try {
      const rows = await getAllChannelsByKindAndCategory(
        'movie',
        categoryName,
        PAGE_SIZE,
        0,
        includeAdult
      );
      loadedCountRef.current = rows.length;
      setMovies(rows);
      setHasMore(rows.length === PAGE_SIZE);
    } finally {
      setLoading(false);
    }
  }, [includeAdult]);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMore || loading) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const offset = loadedCountRef.current;
      const rows = await getAllChannelsByKindAndCategory(
        'movie',
        categoryNameRef.current,
        PAGE_SIZE,
        offset,
        includeAdult
      );
      loadedCountRef.current = offset + rows.length;
      setMovies((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const fresh = rows.filter((r) => !seen.has(r.id));
        return fresh.length === 0 ? prev : [...prev, ...fresh];
      });
      setHasMore(rows.length === PAGE_SIZE);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [hasMore, loading, includeAdult]);

  useEffect(() => {
    if (mode === 'categories') {
      void loadCategories();
    } else {
      void loadInitialGrid(categoryNameRef.current);
    }
  }, [mode, loadCategories, loadInitialGrid, includeAdult]);

  const openGrid = (category: ChannelCategory | null) => {
    setSelectedCategory(category);
    setMode('grid');
    setMovies([]);
    void loadInitialGrid(category?.name ?? null);
  };

  const backToCategories = () => {
    setMode('categories');
    setSelectedCategory(null);
    setMovies([]);
  };

  const emptyMessage = hasXtreamSource
    ? 'Ce compte Xtream ne propose pas de films, ou le catalogue VOD est indisponible pour le moment.'
    : 'Les films de vos playlists apparaîtront ici.';

  const headerTitle =
    mode === 'categories' ? 'Films' : selectedCategory?.name ?? 'Tous les films';

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
          <EmptyState icon="film-outline" title="Aucun film" message={emptyMessage} />
        ) : categories.length === 0 ? (
          <EmptyState
            icon="film-outline"
            title="Aucune catégorie"
            message="Les films n'ont pas de catégorie — affichez-les tous."
            actionLabel="Voir tous les films"
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
      ) : movies.length === 0 ? (
        <EmptyState icon="film-outline" title="Aucun film" message={emptyMessage} />
      ) : (
        <FlatList
          data={movies}
          numColumns={numColumns}
          key={numColumns}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={numColumns > 1 ? styles.row : undefined}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={5}
          removeClippedSubviews
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={colors.brand} style={styles.loader} /> : null
          }
          renderItem={({ item }) => {
            const ratingLabel = formatDisplayRating(item.rating);
            return (
              <Pressable style={[styles.tile, { width: tileWidth }]} onPress={() => router.push(`/player/${item.id}`)}>
                <View style={styles.posterWrap}>
                  {item.logoUrl ? (
                    <Image source={{ uri: item.logoUrl }} style={styles.poster} contentFit="cover" cachePolicy="disk" />
                  ) : (
                    <Text style={styles.fallbackTitle} numberOfLines={4}>
                      {item.name}
                    </Text>
                  )}
                  {ratingLabel ? (
                    <View style={styles.ratingBadge}>
                      <Ionicons name="star" size={11} color={colors.background} />
                      <Text style={styles.ratingText}>{ratingLabel}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.tileTitle} numberOfLines={2}>
                  {item.name}
                </Text>
                <Pressable hitSlop={10} style={styles.favBtn} onPress={() => toggleFavorite(item.id, item.sourceId)}>
                  <Ionicons
                    name={isFavorite(item.id) ? 'heart' : 'heart-outline'}
                    size={16}
                    color={isFavorite(item.id) ? colors.brand : colors.textTertiary}
                  />
                </Pressable>
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
  loader: { paddingVertical: spacing.lg },
  grid: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxxl, gap: spacing.sm },
  row: { gap: spacing.sm },
  tile: { marginBottom: spacing.md },
  posterWrap: {
    aspectRatio: 2 / 3,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: spacing.sm,
  },
  poster: { width: '100%', height: '100%' },
  fallbackTitle: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
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
  favBtn: { position: 'absolute', top: spacing.xs, right: spacing.xs },
});
