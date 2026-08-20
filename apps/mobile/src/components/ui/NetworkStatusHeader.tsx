import { StyleSheet, Text, View } from 'react-native';
import { colors, networkQualityColor, radius, spacing, typography } from '@/theme/tokens';
import { useNetworkState } from '@/store/useNetworkStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { connectionLevelLabel, qualityModeLabel } from '@/utils/networkDisplay';
import { formatPlaybackHeight, usePlaybackQualityStore } from '@/store/usePlaybackQualityStore';

/**
 * Compact connection readout for screens that are not the home hero.
 * Qualité = piste vidéo active (expo-video), sinon "—".
 */
export function NetworkStatusHeader() {
  const network = useNetworkState();
  const qualityMode = useSettingsStore((s) => s.qualityMode);
  const playbackHeight = usePlaybackQualityStore((s) => s.height);
  const dotColor =
    network.quality === 'offline' ? networkQualityColor.offline : networkQualityColor[network.quality];

  return (
    <View style={styles.row}>
      <View style={styles.item}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <Text style={styles.label}>
          Connexion : <Text style={styles.value}>{connectionLevelLabel(network)}</Text>
        </Text>
      </View>
      <View style={styles.separator} />
      <Text style={styles.label}>
        Qualité : <Text style={styles.value}>{formatPlaybackHeight(playbackHeight)}</Text>
      </Text>
      <View style={styles.separator} />
      <Text style={styles.label}>
        Mode : <Text style={styles.value}>{qualityModeLabel(qualityMode)}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceGlass,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignSelf: 'flex-start',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  separator: {
    width: 1,
    height: 12,
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  value: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
});
