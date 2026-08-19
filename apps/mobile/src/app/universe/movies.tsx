import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { Channel } from '@infiny-stream/types';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { EmptyState } from '@/components/ui/EmptyState';
import { UniverseHeader } from '@/components/universe/UniverseHeader';
import { getAllChannelsByKind } from '@/services/channelsRepository';
import { useFavoritesStore } from '@/store/useFavoritesStore';

function formatMeta(item: Channel): string | null {
  const parts: string[] = [];
  if (item.genre) parts.push(item.genre);
  if (item.rating != null) parts.push(String(item.rating));
  if (item.releaseDate) parts.push(item.releaseDate.slice(0, 4));
  return parts.length > 0 ? parts.join(' · ') : null;
}

export default function MoviesUniverseScreen() {
  const { width } = useWindowDimensions();
  const numColumns = useMemo(() => (width >= 1200 ? 5 : width >= 900 ? 4 : width >= 600 ? 3 : 2), [width]);
  const tileWidth = (width - spacing.md * 2 - spacing.sm * (numColumns - 1)) / numColumns;

  const [movies, setMovies] = useState<Channel[]>([]);
  const toggleFavorite = useFavoritesStore((s) => s.toggle);
  const isFavorite = useFavoritesStore((s) => s.isFavorite);

  const reload = useCallback(() => {
    getAllChannelsByKind('movie', 10000).then(setMovies);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <UniverseHeader title="Films" />

      {movies.length === 0 ? (
        <EmptyState icon="film-outline" title="Aucun film" message="Les films de vos playlists apparaîtront ici." />
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
          renderItem={({ item }) => {
            const meta = formatMeta(item);
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
                </View>
                <Text style={styles.tileTitle} numberOfLines={2}>
                  {item.name}
                </Text>
                {!!meta && (
                  <Text style={styles.tileMeta} numberOfLines={1}>
                    {meta}
                  </Text>
                )}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
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
  tileTitle: { ...typography.caption, color: colors.textPrimary, marginTop: spacing.xs },
  tileMeta: { ...typography.label, color: colors.textTertiary, marginTop: 2 },
  favBtn: { position: 'absolute', top: spacing.xs, right: spacing.xs },
});
