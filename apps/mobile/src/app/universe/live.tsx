import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { ScreenSafeArea } from '@/components/ui/ScreenSafeArea';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ChannelCategory, GroupedChannel } from '@infiny-stream/types';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { ChannelRow } from '@/components/ui/ChannelRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { UniverseHeader } from '@/components/universe/UniverseHeader';
import { getCategories, getAllChannelsByKind, getChannels } from '@/services/channelsRepository';
import { groupedFromChannels, groupFavoriteChannel, groupHasFavorite } from '@/services/channelGroups';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import { useSourcesStore } from '@/store/useSourcesStore';

const PAGE_SIZE = 10000;

export default function LiveUniverseScreen() {
  const sources = useSourcesStore((s) => s.sources);
  const toggleFavorite = useFavoritesStore((s) => s.toggle);
  const isFavorite = useFavoritesStore((s) => s.isFavorite);
  const { width } = useWindowDimensions();

  const [categories, setCategories] = useState<ChannelCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [channels, setChannels] = useState<GroupedChannel[]>([]);
  const [loading, setLoading] = useState(true);

  const primarySourceId = sources[0]?.id;

  useEffect(() => {
    if (!primarySourceId) {
      setCategories([]);
      return;
    }
    getCategories(primarySourceId, 'live').then(setCategories);
  }, [primarySourceId]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      let rows;
      if (primarySourceId && selectedCategory) {
        rows = await getChannels(primarySourceId, { kind: 'live', category: selectedCategory, limit: PAGE_SIZE });
      } else {
        rows = await getAllChannelsByKind('live', PAGE_SIZE);
      }
      setChannels(groupedFromChannels(rows));
    } finally {
      setLoading(false);
    }
  }, [primarySourceId, selectedCategory]);

  useEffect(() => {
    reload();
  }, [reload]);

  const numColumns = useMemo(() => (width >= 900 ? 2 : 1), [width]);

  return (
    <ScreenSafeArea style={styles.safeArea}>
      <UniverseHeader title="TV en direct" />

      {categories.length > 0 && (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ id: 'all', name: 'Toutes', channelCount: 0, sourceId: primarySourceId ?? '' }, ...categories]}
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

      {!loading && channels.length === 0 ? (
        <EmptyState icon="tv-outline" title="Aucune chaîne" message="Importez une playlist pour commencer." />
      ) : (
        <FlatList
          data={channels}
          key={numColumns}
          numColumns={numColumns}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          initialNumToRender={24}
          maxToRenderPerBatch={24}
          windowSize={7}
          removeClippedSubviews
          renderItem={({ item }) => {
            const target = groupFavoriteChannel(item);
            return (
              <View style={numColumns > 1 ? styles.gridCell : undefined}>
                <ChannelRow
                  group={item}
                  isFavorite={groupHasFavorite(item, isFavorite)}
                  onPress={() => router.push(`/player/${target.id}`)}
                  onToggleFavorite={() => toggleFavorite(target.id, target.sourceId)}
                />
              </View>
            );
          }}
        />
      )}
    </ScreenSafeArea>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
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
  gridCell: { flex: 1 },
});
