import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { HistoryEntry } from '@infiny-stream/types';
import { colors, elevation, radius, spacing, typography } from '@/theme/tokens';
import { GlassCard } from '@/components/ui/GlassCard';

interface ContinueWatchingCardProps {
  entry: HistoryEntry;
}

export function ContinueWatchingCard({ entry }: ContinueWatchingCardProps) {
  return (
    <GlassCard style={[styles.card, elevation.cardSubtle]}>
      <Text style={styles.kicker}>Continuer à regarder</Text>
      <Pressable onPress={() => router.push(`/player/${entry.channelId}`)} style={styles.row}>
        <View style={styles.logoWrap}>
          {entry.logoUrl ? (
            <Image source={{ uri: entry.logoUrl }} style={styles.logo} contentFit="contain" cachePolicy="disk" transition={0} />
          ) : (
            <Ionicons name="tv-outline" size={28} color={colors.cyan} />
          )}
        </View>
        <View style={styles.copy}>
          <Text style={styles.resume}>Reprendre</Text>
          <Text numberOfLines={2} style={styles.title}>
            {entry.channelName}
          </Text>
        </View>
        <View style={styles.play}>
          <Ionicons name="play" size={18} color={colors.background} />
        </View>
      </Pressable>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md, borderColor: colors.borderStrong, flex: 1 },
  kicker: { ...typography.label, color: colors.cyan },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logoWrap: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: { width: 56, height: 56 },
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
