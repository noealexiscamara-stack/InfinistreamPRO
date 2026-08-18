import { StyleSheet, Text, View } from 'react-native';
import { colors, networkQualityColor, radius, spacing, typography } from '@/theme/tokens';
import { useNetworkState } from '@/store/useNetworkStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { connectionLevelLabel, currentQualityLabel, hasNetworkMeasurement, qualityModeLabel } from '@/utils/networkDisplay';

/**
 * Compact connection readout for screens that are not the home hero.
 * Values come from NetworkMonitor; unmeasured quality stays neutral.
 */
export function NetworkStatusHeader() {
  const network = useNetworkState();
  const qualityMode = useSettingsStore((s) => s.qualityMode);
  const measured = hasNetworkMeasurement(network);
  const dotColor = network.quality === 'offline' ? networkQualityColor.offline : measured ? networkQualityColor[network.quality] : colors.textTertiary;

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
        Qualité : <Text style={styles.value}>{currentQualityLabel(network)}</Text>
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
