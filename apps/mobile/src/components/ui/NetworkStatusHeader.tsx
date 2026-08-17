import { StyleSheet, Text, View } from 'react-native';
import { NETWORK_QUALITY_LABELS, QUALITY_MODE_LABELS } from '@infiny-stream/types';
import { colors, networkQualityColor, radius, spacing, typography } from '@/theme/tokens';
import { useNetworkState } from '@/store/useNetworkStore';
import { useSettingsStore } from '@/store/useSettingsStore';

/**
 * The one piece of "network truth" shown to the user, everywhere,
 * expressed the way product rule #3 asks for it — never bitrate/buffer/
 * codec jargon, just Connexion / Qualité / Mode.
 */
export function NetworkStatusHeader() {
  const network = useNetworkState();
  const qualityMode = useSettingsStore((s) => s.qualityMode);

  const qualityLabel =
    network.quality === 'offline'
      ? '—'
      : network.estimatedThroughputKbps >= 4000
        ? 'Full HD'
        : network.estimatedThroughputKbps >= 1500
          ? 'HD'
          : network.estimatedThroughputKbps > 0
            ? 'SD'
            : 'Auto';

  return (
    <View style={styles.row}>
      <View style={styles.item}>
        <View style={[styles.dot, { backgroundColor: networkQualityColor[network.quality] }]} />
        <Text style={styles.label}>
          Connexion : <Text style={styles.value}>{NETWORK_QUALITY_LABELS[network.quality]}</Text>
        </Text>
      </View>
      <View style={styles.separator} />
      <Text style={styles.label}>
        Qualité : <Text style={styles.value}>{qualityLabel}</Text>
      </Text>
      <View style={styles.separator} />
      <Text style={styles.label}>
        Mode : <Text style={styles.value}>{QUALITY_MODE_LABELS[qualityMode]}</Text>
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
