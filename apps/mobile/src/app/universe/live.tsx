import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Channel, ChannelCategory, GroupedChannel } from '@infiny-stream/types';
import { colors, spacing, typography } from '@/theme/tokens';
import { ScreenSafeArea } from '@/components/ui/ScreenSafeArea';
import { EmptyState } from '@/components/ui/EmptyState';
import { ChannelGridTile } from '@/components/universe/ChannelGridTile';
import { LiveCategorySidebar, categoriesToSidebarItems } from '@/components/universe/LiveCategorySidebar';
import { getCategories, getAllChannelsByKind, getChannels, countChannels } from '@/services/channelsRepository';
import { groupedFromChannels, groupFavoriteChannel } from '@/services/channelGroups';
import { useSourcesStore } from '@/store/useSourcesStore';
import { useParentalStore } from '@/store/useParentalStore';

const PAGE_SIZE = 120;
/** Fixed 6 columns in landscape phone — requirement vs Smarters density. */
const TARGET_COLUMNS = 6;

export default function LiveUniverseScreen() {
  const sources = useSourcesStore((s) => s.sources);
  const unlocked = useParentalStore((s) => s.unlocked);
  const pinConfigured = useParentalStore((s) => s.pinConfigured);
  const includeAdult = pinConfigured && unlocked;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [categories, setCategories] = useState<ChannelCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [rawChannels, setRawChannels] = useState<Channel[]>([]);
  const [channels, setChannels] = useState<GroupedChannel[]>([]);
  const [totalLiveCount, setTotalLiveCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const loadedCountRef = useRef(0);

  const primarySourceId = sources[0]?.id;

  const contentWidth = Math.max(200, width - insets.left - insets.right);
  const sidebarWidth = useMemo(
    () => Math.min(240, Math.max(168, contentWidth * 0.26)),
    [contentWidth]
  );
  const gridWidth = Math.max(160, contentWidth - sidebarWidth);
  const numColumns = TARGET_COLUMNS;
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
    getCategories(primarySourceId, 'live', includeAdult).then(setCategories);
  }, [primarySourceId, includeAdult]);

  const fetchRows = useCallback(
    async (offset: number) => {
      if (primarySourceId && selectedCategoryName) {
        return getChannels(primarySourceId, {
          kind: 'live',
          category: selectedCategoryName,
          limit: PAGE_SIZE,
          offset,
          includeAdult,
        });
      }
      return getAllChannelsByKind('live', PAGE_SIZE, offset, includeAdult);
    },
    [primarySourceId, selectedCategoryName, includeAdult]
  );

  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchRows(0);
      loadedCountRef.current = rows.length;
      setRawChannels(rows);
      setChannels(groupedFromChannels(rows));
      setHasMore(rows.length === PAGE_SIZE);
      if (!selectedCategoryName) {
        setTotalLiveCount(
          await countChannels({ kind: 'live', sourceId: primarySourceId, includeAdult })
        );
      }
    } finally {
      setLoading(false);
    }
  }, [fetchRows, primarySourceId, selectedCategoryName, includeAdult]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const rows = await fetchRows(loadedCountRef.current);
      loadedCountRef.current += rows.length;
      setRawChannels((prev) => {
        const merged = [...prev, ...rows];
        setChannels(groupedFromChannels(merged));
        return merged;
      });
      setHasMore(rows.length === PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  }, [fetchRows, hasMore, loadingMore]);

  useEffect(() => {
    loadedCountRef.current = 0;
    setRawChannels([]);
    setChannels([]);
    setHasMore(false);
    void loadInitial();
  }, [loadInitial]);

  const sidebarItems = useMemo(() => categoriesToSidebarItems(categories), [categories]);

  return (
    <ScreenSafeArea style={styles.safeArea}>
      <View style={styles.shell}>
        <LiveCategorySidebar
          categories={sidebarItems}
          selectedId={selectedCategoryId}
          onSelect={setSelectedCategoryId}
          totalCount={totalLiveCount}
          width={sidebarWidth}
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
              initialNumToRender={36}
              maxToRenderPerBatch={36}
              windowSize={7}
              removeClippedSubviews
              onEndReached={() => {
                void loadMore();
              }}
              onEndReachedThreshold={0.4}
              ListFooterComponent={
                loadingMore ? (
                  <Text style={styles.loadingMore}>Chargement…</Text>
                ) : null
              }
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
  main: { flex: 1, minWidth: 0 },
  gridHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  back: { padding: spacing.xs },
  gridTitle: { ...typography.headline, color: colors.textPrimary, flex: 1, textAlign: 'center' },
  headerSpacer: { width: 30 },
  grid: { paddingHorizontal: spacing.xs, paddingBottom: spacing.lg },
  gridRow: { gap: 0 },
  loadingMore: { ...typography.caption, color: colors.textTertiary, textAlign: 'center', paddingVertical: spacing.md },
});
