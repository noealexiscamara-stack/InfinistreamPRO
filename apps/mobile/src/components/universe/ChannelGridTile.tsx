import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { GroupedChannel } from '@infiny-stream/types';
import { colors, radius, spacing, typography } from '@/theme/tokens';

interface ChannelGridTileProps {
  group: GroupedChannel;
  onPress: () => void;
  tileWidth: number;
}

/** Compact logo tile — single-line truncated name; full name on tap (player). */
export function ChannelGridTile({ group, onPress, tileWidth }: ChannelGridTileProps) {
  const [logoFailed, setLogoFailed] = useState(false);
  const logoSize = Math.round(Math.min(tileWidth * 0.72, tileWidth - 8));
  const showLogo = group.logoUrl && !logoFailed;

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={group.name}
      style={({ pressed }) => [styles.tile, { width: tileWidth }, pressed && styles.pressed]}
    >
      <View style={[styles.logoBox, { height: logoSize + 6 }]}>
        {showLogo ? (
          <Image
            source={{ uri: group.logoUrl }}
            style={{ width: logoSize, height: logoSize }}
            contentFit="contain"
            cachePolicy="disk"
            transition={100}
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <View style={[styles.fallback, { width: logoSize, height: logoSize }]}>
            <Ionicons name="tv-outline" size={Math.round(logoSize * 0.36)} color={colors.textTertiary} />
          </View>
        )}
      </View>
      <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
        {group.name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    paddingHorizontal: 2,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    gap: 2,
  },
  pressed: {
    opacity: 0.85,
  },
  logoBox: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fallback: {
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    ...typography.caption,
    fontSize: 10,
    lineHeight: 13,
    color: colors.textPrimary,
    textAlign: 'center',
    fontWeight: '600',
    width: '100%',
  },
});
