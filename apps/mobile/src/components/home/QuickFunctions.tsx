import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, elevation, radius, spacing, typography, type UniverseId, universeThemes } from '@/theme/tokens';

export interface QuickFunctionItem {
  id: string;
  universeId: UniverseId;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  meta: string;
  disabled?: boolean;
  onPress?: () => void;
}

interface QuickFunctionsProps {
  items: QuickFunctionItem[];
  scale?: number;
  dense?: boolean;
}

export function QuickFunctions({ items, scale = 1, dense = false }: QuickFunctionsProps) {
  const minHeight = Math.round((dense ? 72 : 96) * scale);

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { fontSize: Math.round(17 * scale) }]}>Fonctions rapides</Text>
      <View style={styles.grid}>
        {items.map((item) => (
          <QuickTile key={item.id} item={item} minHeight={minHeight} scale={scale} />
        ))}
      </View>
    </View>
  );
}

function QuickTile({
  item,
  minHeight,
  scale,
}: {
  item: QuickFunctionItem;
  minHeight: number;
  scale: number;
}) {
  const theme = universeThemes[item.universeId];
  const content = (
    <LinearGradient
      colors={[theme.gradient[0], theme.gradient[1]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[styles.tile, { minHeight, padding: Math.round(spacing.md * scale) }, elevation.cardGlow(theme.glow), item.disabled && styles.tileDisabled]}
    >
      <View style={[styles.icon, { backgroundColor: `${theme.accent}22`, borderColor: `${theme.accent}55` }]}>
        <Ionicons name={item.icon} size={Math.round(18 * scale)} color={theme.accent} />
      </View>
      <Text style={[styles.title, { fontSize: Math.round(13 * scale) }]} numberOfLines={1}>
        {item.title}
      </Text>
      <Text style={[styles.meta, { fontSize: Math.round(11 * scale) }]} numberOfLines={1}>
        {item.meta}
      </Text>
    </LinearGradient>
  );

  if (item.disabled || !item.onPress) {
    return <View style={styles.cell}>{content}</View>;
  }

  return (
    <Pressable onPress={item.onPress} style={styles.cell}>
      {content}
    </Pressable>
  );
}

/** Default six tiles matching the TV mockup; callers can override metas. */
export function buildDefaultQuickFunctions(opts: {
  liveCount: number;
  movieCount: number;
  seriesCount: number;
  favoriteCount: number;
}): QuickFunctionItem[] {
  return [
    {
      id: 'live',
      universeId: 'live',
      icon: 'tv-outline',
      title: 'TV en direct',
      meta: opts.liveCount > 0 ? 'Regarder maintenant' : 'Aucune chaîne',
      onPress: () => router.push('/universe/live'),
    },
    {
      id: 'movies',
      universeId: 'movies',
      icon: 'film-outline',
      title: 'Films',
      meta: opts.movieCount > 0 ? 'Découvrir' : 'Aucun film',
      onPress: () => router.push('/universe/movies'),
    },
    {
      id: 'series',
      universeId: 'series',
      icon: 'albums-outline',
      title: 'Séries',
      meta: opts.seriesCount > 0 ? 'Explorer' : 'Aucune série',
      onPress: () => router.push('/universe/series'),
    },
    {
      id: 'replay',
      universeId: 'replay',
      icon: 'refresh-circle-outline',
      title: 'Relecture',
      meta: 'Bientôt',
      disabled: true,
    },
    {
      id: 'favorites',
      universeId: 'favorites',
      icon: 'heart-outline',
      title: 'Favoris',
      meta: opts.favoriteCount > 0 ? 'Vos contenus' : 'Aucun',
      onPress: () => router.push('/(tabs)/favorites'),
    },
    {
      id: 'categories',
      universeId: 'categories',
      icon: 'grid-outline',
      title: 'Toutes catégories',
      meta: 'Explorer tout',
      onPress: () => router.push('/playlists'),
    },
  ];
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  sectionTitle: { ...typography.headline, color: colors.textPrimary },
  grid: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: spacing.sm,
  },
  cell: {
    flex: 1,
    minWidth: 0,
  },
  tile: {
    gap: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
  },
  tileDisabled: {
    opacity: 0.55,
  },
  icon: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...typography.bodyStrong, color: colors.textPrimary },
  meta: { ...typography.caption, color: colors.textSecondary },
});
