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

/** Smarters-style grid tile: large logo, channel name underneath. */
export function ChannelGridTile({ group, onPress, tileWidth }: ChannelGridTileProps) {
  const [logoFailed, setLogoFailed] = useState(false);
  const logoSize = Math.round(tileWidth * 0.62);
  const showLogo = group.logoUrl && !logoFailed;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tile, { width: tileWidth }, pressed && styles.pressed]}
    >
      <View style={[styles.logoBox, { height: logoSize + spacing.md }]}>
        {showLogo ? (
          <Image
            source={{ uri: group.logoUrl }}
            style={{ width: logoSize, height: logoSize }}
            contentFit="contain"
            cachePolicy="disk"
            transition={120}
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <View style={[styles.fallback, { width: logoSize, height: logoSize }]}>
            <Ionicons name="tv-outline" size={Math.round(logoSize * 0.38)} color={colors.textTertiary} />
          </View>
        )}
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {group.name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    padding: spacing.sm,
    alignItems: 'center',
    gap: spacing.xs,
  },
  pressed: {
    opacity: 0.85,
  },
  logoBox: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fallback: {
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    ...typography.caption,
    color: colors.textPrimary,
    textAlign: 'center',
    fontWeight: '600',
    width: '100%',
  },
});
