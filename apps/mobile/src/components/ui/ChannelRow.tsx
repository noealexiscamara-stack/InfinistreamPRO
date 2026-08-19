import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { GroupedChannel } from '@infiny-stream/types';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { ladderBadge } from '@/services/channelGroups';

interface ChannelRowProps {
  group: GroupedChannel;
  isFavorite?: boolean;
  onPress: () => void;
  onToggleFavorite?: () => void;
}

/**
 * List rows are the highest-frequency render in the app (playlists can
 * have thousands of channels), so this stays deliberately simple: no
 * blur, no shadows, a single expo-image with `cachePolicy="disk"` for
 * progressive/lazy logo loading rather than blocking the row on the
 * network (product rule #8).
 */
export function ChannelRow({ group, isFavorite, onPress, onToggleFavorite }: ChannelRowProps) {
  const badge = ladderBadge(group);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.logoWrap}>
        {group.logoUrl ? (
          <Image source={{ uri: group.logoUrl }} style={styles.logo} contentFit="contain" cachePolicy="disk" transition={150} />
        ) : (
          <Ionicons name="tv-outline" size={20} color={colors.textTertiary} />
        )}
      </View>
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {group.name}
          </Text>
          {!!badge && (
            <View style={styles.badge}>
              <Text style={styles.badgeLabel}>{badge}</Text>
            </View>
          )}
        </View>
        {!!group.groupTitle && (
          <Text style={styles.meta} numberOfLines={1}>
            {group.groupTitle}
          </Text>
        )}
      </View>
      {onToggleFavorite && (
        <Pressable hitSlop={12} onPress={onToggleFavorite} style={styles.favoriteButton}>
          <Ionicons name={isFavorite ? 'heart' : 'heart-outline'} size={20} color={isFavorite ? colors.brand : colors.textTertiary} />
        </Pressable>
      )}
    </Pressable>
  );
}

const LOGO_SIZE = 40;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    gap: spacing.md,
  },
  pressed: {
    backgroundColor: colors.surface,
  },
  logoWrap: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: {
    width: LOGO_SIZE - 8,
    height: LOGO_SIZE - 8,
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeLabel: {
    ...typography.label,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.brand,
    textTransform: 'uppercase',
  },
  meta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  favoriteButton: {
    padding: spacing.xs,
  },
});
