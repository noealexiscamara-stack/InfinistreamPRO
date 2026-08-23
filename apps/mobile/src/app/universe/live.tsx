import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ChannelCategory, GroupedChannel } from '@infiny-stream/types';
import { colors, spacing, typography } from '@/theme/tokens';
import { ScreenSafeArea } from '@/components/ui/ScreenSafeArea';
import { EmptyState } from '@/components/ui/EmptyState';
import { ChannelGridTile } from '@/components/universe/ChannelGridTile';
import { LiveCategorySidebar, categoriesToSidebarItems } from '@/components/universe/LiveCategorySidebar';
import { getCategories, getAllChannelsByKind, getChannels } from '@/services/channelsRepository';
import { groupedFromChannels, groupFavoriteChannel } from '@/services/channelGroups';
import { useSourcesStore } from '@/store/useSourcesStore';

const PAGE_SIZE = 10000;
const MIN_TILE_WIDTH = 132;

export default function LiveUniverseScreen() {
  const sources = useSourcesStore((s) => s.sources);
  const { width } = useWindowDimensions();

  const [categories, setCategories] = useState<ChannelCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [channels, setChannels] = useState<GroupedChannel[]>([]);
  const [totalLiveCount, setTotalLiveCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const primarySourceId = sources[0]?.id;

  const sidebarWidth = useMemo(() => Math.min(280, Math.max(200, width * 0.3)), [width]);
  const gridWidth = Math.max(200, width - sidebarWidth);
  const numColumns = useMemo(() => Math.max(3, Math.floor(gridWidth / MIN_TILE_WIDTH)), [gridWidth]);
  const tileWidth = gridWidth / numColumns;

  const selectedCategoryName = useMemo(() => {
    if (selectedCategoryId === 'all') return undefined;
    return categories.find((c) => c.id === selectedCategoryId)?.name;
  }, [categories, selectedCategoryId]);

  const headerTitle = selectedCategoryName ?? 'TOUT';

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
      if (primarySourceId && selectedCategoryName) {
        rows = await getChannels(primarySourceId, { kind: 'live', category: selectedCategoryName, limit: PAGE_SIZE });
      } else {
        rows = await getAllChannelsByKind('live', PAGE_SIZE);
      }
      const grouped = groupedFromChannels(rows);
      setChannels(grouped);
      if (!selectedCategoryName) setTotalLiveCount(grouped.length);
    } finally {
      setLoading(false);
    }
  }, [primarySourceId, selectedCategoryName]);

  useEffect(() => {
    reload();
  }, [reload]);

  const sidebarItems = useMemo(() => categoriesToSidebarItems(categories), [categories]);

  return (
    <ScreenSafeArea style={styles.safeArea}>
      <View style={styles.shell}>
        <LiveCategorySidebar
          categories={sidebarItems}
          selectedId={selectedCategoryId}
          onSelect={setSelectedCategoryId}
          totalCount={totalLiveCount}
        />

        <View style={styles.main}>
          <View style={styles.gridHeader}>
            <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
              <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
            </Pressable>
            <Text style={styles.gridTitle} numberOfLines={1}>
              {headerTitle}
            </Text>
            <View style={styles.headerSpacer} />
          </View>

          {!loading && channels.length === 0 ? (
            <EmptyState icon="tv-outline" title="Aucune chaîne" message="Importez une playlist pour commencer." />
          ) : (
            <FlatList
              data={channels}
              key={numColumns}
              numColumns={numColumns}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.grid}
              columnWrapperStyle={numColumns > 1 ? styles.gridRow : undefined}
              initialNumToRender={24}
              maxToRenderPerBatch={24}
              windowSize={7}
              removeClippedSubviews
              renderItem={({ item }) => {
                const target = groupFavoriteChannel(item);
                return (
                  <ChannelGridTile
                    group={item}
                    tileWidth={tileWidth}
                    onPress={() => router.push(`/player/${target.id}`)}
                  />
                );
              }}
            />
          )}
        </View>
      </View>
    </ScreenSafeArea>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  shell: { flex: 1, flexDirection: 'row' },
  main: { flex: 1 },
  gridHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  back: { padding: spacing.xs },
  gridTitle: { ...typography.headline, color: colors.textPrimary, flex: 1, textAlign: 'center' },
  headerSpacer: { width: 30 },
  grid: { padding: spacing.sm, paddingBottom: spacing.xl },
  gridRow: { gap: 0 },
});
