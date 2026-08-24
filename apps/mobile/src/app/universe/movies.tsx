import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { ScreenSafeArea } from '@/components/ui/ScreenSafeArea';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { Channel } from '@infiny-stream/types';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { EmptyState } from '@/components/ui/EmptyState';
import { UniverseHeader } from '@/components/universe/UniverseHeader';
import { getAllChannelsByKind } from '@/services/channelsRepository';
import { formatDisplayRating } from '@/services/xtream/mapXtreamCatalog';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import { useSourcesStore } from '@/store/useSourcesStore';

const PAGE_SIZE = 120;

export default function MoviesUniverseScreen() {
  const { width } = useWindowDimensions();
  const numColumns = useMemo(() => (width >= 1200 ? 5 : width >= 900 ? 4 : width >= 600 ? 3 : 2), [width]);
  const tileWidth = (width - spacing.md * 2 - spacing.sm * (numColumns - 1)) / numColumns;

  const [movies, setMovies] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const loadedCountRef = useRef(0);
  const hasXtreamSource = useSourcesStore((s) => s.sources.some((src) => src.type === 'xtream'));
  const toggleFavorite = useFavoritesStore((s) => s.toggle);
  const isFavorite = useFavoritesStore((s) => s.isFavorite);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await getAllChannelsByKind('movie', PAGE_SIZE, 0);
      loadedCountRef.current = rows.length;
      setMovies(rows);
      setHasMore(rows.length === PAGE_SIZE);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const rows = await getAllChannelsByKind('movie', PAGE_SIZE, loadedCountRef.current);
      loadedCountRef.current += rows.length;
      setMovies((prev) => [...prev, ...rows]);
      setHasMore(rows.length === PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore]);

  useEffect(() => {
    loadedCountRef.current = 0;
    setMovies([]);
    setHasMore(false);
    void loadInitial();
  }, [loadInitial]);

  const emptyMessage = hasXtreamSource
    ? 'Ce compte Xtream ne propose pas de films, ou le catalogue VOD est indisponible pour le moment.'
    : 'Les films de vos playlists apparaîtront ici.';

  return (
    <ScreenSafeArea style={styles.safeArea}>
      <UniverseHeader title="Films" />

      {loading ? (
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
