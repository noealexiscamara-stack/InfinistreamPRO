import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, networkQualityColor, radius, spacing, typography } from '@/theme/tokens';
import { GlassCard } from '@/components/ui/GlassCard';
import { useNetworkState } from '@/store/useNetworkStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import {
  connectionLevelLabel,
  currentQualityLabel,
  hasNetworkMeasurement,
  qualityModeLabel,
  throughputLabel,
} from '@/utils/networkDisplay';

export function SmartConnectionCard() {
  const network = useNetworkState();
  const qualityMode = useSettingsStore((s) => s.qualityMode);
  const measured = hasNetworkMeasurement(network);
  const level = connectionLevelLabel(network);
  const quality = currentQualityLabel(network);
  const throughput = throughputLabel(network);
  const indicatorColor =
    network.quality === 'offline'
      ? networkQualityColor.offline
      : measured
        ? networkQualityColor[network.quality]
        : colors.textTertiary;

  return (
    <GlassCard style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.iconWrap, { borderColor: indicatorColor }]}>
          <Ionicons
            name={network.quality === 'offline' ? 'cloud-offline-outline' : 'wifi'}
            size={22}
            color={indicatorColor}
          />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>Smart Connection</Text>
          <Text style={styles.level}>
            {network.quality === 'offline' ? 'Hors ligne' : measured ? `Connexion ${level.toLowerCase()}` : 'Mesure en attente'}
          </Text>
        </View>
      </View>

      <View style={styles.metrics}>
        <Metric label="Connexion" value={level} />
        <Metric label="Qualité actuelle" value={quality} />
        <Metric label="Mode" value={qualityModeLabel(qualityMode)} />
      </View>

      {throughput ? (
        <Text style={[styles.throughput, { color: network.isStable ? colors.success : colors.textSecondary }]}>
          {throughput}
          {network.isStable ? ' · Stable' : ''}
        </Text>
      ) : (
        <Text style={styles.hint}>La qualité s’affiche dès qu’une chaîne est en lecture.</Text>
      )}
    </GlassCard>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  kicker: {
    ...typography.label,
    color: colors.cyan,
  },
  level: {
    ...typography.headline,
    color: colors.textPrimary,
  },
  metrics: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metric: {
    flex: 1,
    gap: 2,
  },
  metricLabel: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  metricValue: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  throughput: {
    ...typography.caption,
    fontWeight: '600',
  },
  hint: {
    ...typography.caption,
    color: colors.textTertiary,
  },
});
