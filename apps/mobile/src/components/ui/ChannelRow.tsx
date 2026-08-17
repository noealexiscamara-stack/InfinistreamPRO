import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { Channel } from '@infiny-stream/types';
import { colors, radius, spacing, typography } from '@/theme/tokens';

interface ChannelRowProps {
  channel: Channel;
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
export function ChannelRow({ channel, isFavorite, onPress, onToggleFavorite }: ChannelRowProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.logoWrap}>
        {channel.logoUrl ? (
          <Image source={{ uri: channel.logoUrl }} style={styles.logo} contentFit="contain" cachePolicy="disk" transition={150} />
        ) : (
          <Ionicons name="tv-outline" size={20} color={colors.textTertiary} />
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {channel.name}
        </Text>
        {!!channel.groupTitle && (
          <Text style={styles.meta} numberOfLines={1}>
            {channel.groupTitle}
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
  name: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
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
