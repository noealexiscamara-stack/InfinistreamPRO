import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ChannelCategory } from '@infiny-stream/types';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export interface LiveCategoryItem {
  id: string;
  name: string;
  count: number;
}

interface LiveCategorySidebarProps {
  categories: LiveCategoryItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  totalCount: number;
}

export function LiveCategorySidebar({ categories, selectedId, onSelect, totalCount }: LiveCategorySidebarProps) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, query]);

  const rows: LiveCategoryItem[] = useMemo(
    () => [{ id: 'all', name: 'TOUT', count: totalCount }, ...filtered],
    [filtered, totalCount]
  );

  return (
    <View style={styles.sidebar}>
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={colors.textTertiary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Rechercher dans les catégories"
          placeholderTextColor={colors.textTertiary}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const selected = item.id === selectedId;
          return (
            <Pressable
              onPress={() => onSelect(item.id)}
              style={[styles.row, selected && styles.rowSelected]}
            >
              <Text style={[styles.rowLabel, selected && styles.rowLabelSelected]} numberOfLines={2}>
                {item.name}
              </Text>
              <Text style={[styles.rowCount, selected && styles.rowCountSelected]}>{item.count}</Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

/** Maps repository categories to sidebar items. */
export function categoriesToSidebarItems(categories: ChannelCategory[]): LiveCategoryItem[] {
  return categories.map((c) => ({ id: c.id, name: c.name, count: c.channelCount }));
}

const styles = StyleSheet.create({
  sidebar: {
    width: '30%',
    minWidth: 200,
    maxWidth: 280,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    backgroundColor: colors.backgroundElevated,
    paddingVertical: spacing.sm,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  searchInput: {
    flex: 1,
    ...typography.caption,
    color: colors.textPrimary,
    paddingVertical: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.xs,
    borderRadius: radius.sm,
  },
  rowSelected: {
    backgroundColor: colors.brand,
  },
  rowLabel: {
    flex: 1,
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  rowLabelSelected: {
    color: colors.textPrimary,
  },
  rowCount: {
    ...typography.caption,
    color: colors.textTertiary,
    fontWeight: '700',
  },
  rowCountSelected: {
    color: colors.textPrimary,
  },
});
