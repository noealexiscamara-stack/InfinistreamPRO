import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ChannelCategory } from '@infiny-stream/types';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { LANGUAGE_OTHER, groupCategoriesByLanguage, languageFromCategoryName } from '@/utils/categoryLanguage';

interface CategoryBrowserProps {
  categories: ChannelCategory[];
  languageFilter: string | null;
  onSelectLanguage: (language: string | null) => void;
  onSelectCategory: (category: ChannelCategory) => void;
  onSelectAll: () => void;
  totalCount: number;
}

export function CategoryBrowser({
  categories,
  languageFilter,
  onSelectLanguage,
  onSelectCategory,
  onSelectAll,
  totalCount,
}: CategoryBrowserProps) {
  const languages = Array.from(new Set(categories.map((c) => languageFromCategoryName(c.name)))).sort((a, b) => {
    if (a === LANGUAGE_OTHER) return 1;
    if (b === LANGUAGE_OTHER) return -1;
    return a.localeCompare(b, 'fr');
  });

  const filtered =
    languageFilter == null
      ? categories
      : categories.filter((c) => languageFromCategoryName(c.name) === languageFilter);

  const grouped = groupCategoriesByLanguage(filtered);

  return (
    <View style={styles.wrap}>
      <Pressable style={styles.allRow} onPress={onSelectAll}>
        <Text style={styles.allTitle}>Toutes les catégories</Text>
        <Text style={styles.allMeta}>{totalCount.toLocaleString('fr-FR')} titres</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
      </Pressable>

      <View style={styles.langRow}>
        <Pressable
          style={[styles.langChip, languageFilter == null && styles.langChipActive]}
          onPress={() => onSelectLanguage(null)}
        >
          <Text style={[styles.langLabel, languageFilter == null && styles.langLabelActive]}>Toutes</Text>
        </Pressable>
        {languages.map((lang) => (
          <Pressable
            key={lang}
            style={[styles.langChip, languageFilter === lang && styles.langChipActive]}
            onPress={() => onSelectLanguage(lang)}
          >
            <Text style={[styles.langLabel, languageFilter === lang && styles.langLabelActive]}>{lang}</Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={grouped}
        keyExtractor={(item) => item.language}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.langSection}>
            <Text style={styles.langHeading}>{item.language}</Text>
            {item.categories.map((cat) => (
              <Pressable key={cat.id} style={styles.catRow} onPress={() => onSelectCategory(cat)}>
                <Text style={styles.catName} numberOfLines={1}>
                  {cat.name}
                </Text>
                <Text style={styles.catCount}>{cat.channelCount}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
              </Pressable>
            ))}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  allRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  allTitle: { ...typography.bodyStrong, color: colors.textPrimary, flex: 1 },
  allMeta: { ...typography.caption, color: colors.textSecondary },
  langRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  langChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  langChipActive: { backgroundColor: colors.cyan },
  langLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  langLabelActive: { color: colors.background },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxxl, gap: spacing.md },
  langSection: { gap: spacing.xs },
  langHeading: { ...typography.label, color: colors.textTertiary, marginBottom: spacing.xs },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  catName: { ...typography.body, color: colors.textPrimary, flex: 1 },
  catCount: { ...typography.caption, color: colors.textSecondary },
});
