import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Channel, ChannelCategory } from '@infiny-stream/types';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { ChannelRow } from '@/components/ui/ChannelRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { getCategories, getChannels } from '@/services/channelsRepository';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import { useSourcesStore } from '@/store/useSourcesStore';

const PAGE_SIZE = 300;

export default function PlaylistChannelsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const source = useSourcesStore((s) => s.sources.find((src) => src.id === id));
  const toggleFavorite = useFavoritesStore((s) => s.toggle);
  const isFavorite = useFavoritesStore((s) => s.isFavorite);

  const [categories, setCategories] = useState<ChannelCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [channels, setChannels] = useState<Channel[]>([]);

  useEffect(() => {
    if (!id) return;
    getCategories(id).then(setCategories);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    getChannels(id, { category: selectedCategory, limit: PAGE_SIZE }).then(setChannels);
  }, [id, selectedCategory]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {source?.name ?? 'Playlist'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {categories.length > 0 && (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ id: 'all', name: 'Toutes', channelCount: 0, sourceId: id ?? '' }, ...categories]}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.categoryList}
          renderItem={({ item }) => {
            const selected = item.id === 'all' ? selectedCategory === undefined : selectedCategory === item.name;
            return (
              <Pressable
                onPress={() => setSelectedCategory(item.id === 'all' ? undefined : item.name)}
                style={[styles.categoryPill, selected && styles.categoryPillSelected]}
              >
                <Text style={[styles.categoryLabel, selected && styles.categoryLabelSelected]}>{item.name}</Text>
              </Pressable>
            );
          }}
        />
      )}

      {channels.length === 0 ? (
        <EmptyState icon="tv-outline" title="Aucune chaîne" message="Cette catégorie est vide, ou la playlist n'a pas encore été chargée." />
      ) : (
        <FlatList
          data={channels}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <ChannelRow
              channel={item}
              isFavorite={isFavorite(item.id)}
              onPress={() => router.push(`/player/${item.id}`)}
              onToggleFavorite={() => toggleFavorite(item.id, item.sourceId)}
            />
          )}
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={7}
          removeClippedSubviews
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  title: { ...typography.headline, color: colors.textPrimary, flex: 1, textAlign: 'center' },
  categoryList: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.md },
  categoryPill: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryPillSelected: { backgroundColor: colors.brand, borderColor: colors.brand },
  categoryLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  categoryLabelSelected: { color: colors.textPrimary },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxxl },
});
