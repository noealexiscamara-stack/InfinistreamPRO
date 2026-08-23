import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { HistoryEntry } from '@infiny-stream/types';
import { colors, elevation, radius, spacing, typography } from '@/theme/tokens';
import { GlassCard } from '@/components/ui/GlassCard';

interface ContinueWatchingCardProps {
  entry: HistoryEntry;
  scale?: number;
  dense?: boolean;
}

export function ContinueWatchingCard({ entry, scale = 1, dense = false }: ContinueWatchingCardProps) {
  const logoSize = Math.round((dense ? 44 : 56) * scale);
  return (
    <GlassCard style={[styles.card, elevation.cardSubtle, { flex: 1, padding: Math.round(spacing.md * scale) }]}>
      {!dense && <Text style={styles.kicker}>Continuer à regarder</Text>}
      <Pressable onPress={() => router.push(`/player/${entry.channelId}`)} style={styles.row}>
        <View style={[styles.logoWrap, { width: logoSize, height: logoSize }]}>
          {entry.logoUrl ? (
            <Image source={{ uri: entry.logoUrl }} style={{ width: logoSize - 8, height: logoSize - 8 }} contentFit="contain" cachePolicy="disk" transition={0} />
          ) : (
            <Ionicons name="tv-outline" size={Math.round(logoSize * 0.45)} color={colors.cyan} />
          )}
        </View>
        <View style={styles.copy}>
          {!dense && <Text style={styles.resume}>Reprendre</Text>}
          <Text numberOfLines={dense ? 1 : 2} style={[styles.title, { fontSize: Math.round((dense ? 14 : 17) * scale) }]}>
            {entry.channelName}
          </Text>
        </View>
        <View style={[styles.play, { width: Math.round(40 * scale), height: Math.round(40 * scale) }]}>
          <Ionicons name="play" size={Math.round(16 * scale)} color={colors.background} />
        </View>
      </Pressable>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, borderColor: colors.borderStrong },
  kicker: { ...typography.label, color: colors.cyan },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logoWrap: {
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  copy: { flex: 1, gap: 2 },
  resume: { ...typography.label, color: colors.cyan },
  title: { ...typography.headline, color: colors.textPrimary },
  play: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
