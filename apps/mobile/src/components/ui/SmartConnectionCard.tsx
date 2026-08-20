import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, elevation, networkQualityColor, radius, spacing, typography } from '@/theme/tokens';
import { GlassCard } from '@/components/ui/GlassCard';
import { useNetworkState } from '@/store/useNetworkStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import {
  connectionDisplay,
  connectionLevelLabel,
  qualityModeLabel,
  throughputLabel,
} from '@/utils/networkDisplay';
import { formatPlaybackHeight, usePlaybackQualityStore } from '@/store/usePlaybackQualityStore';

export function SmartConnectionCard() {
  const network = useNetworkState();
  const qualityMode = useSettingsStore((s) => s.qualityMode);
  const playbackHeight = usePlaybackQualityStore((s) => s.height);
  const { title, subtitle } = connectionDisplay(network);
  const level = connectionLevelLabel(network);
  const quality = formatPlaybackHeight(playbackHeight);
  const throughput = throughputLabel(network);
  const indicatorColor =
    network.quality === 'offline'
      ? networkQualityColor.offline
      : networkQualityColor[network.quality];

  return (
    <GlassCard style={[styles.card, elevation.cardGlow(indicatorColor)]}>
      <View style={styles.header}>
        <View style={[styles.iconWrap, { borderColor: indicatorColor, backgroundColor: `${indicatorColor}18` }]}>
          <Ionicons
            name={network.quality === 'offline' ? 'cloud-offline-outline' : 'wifi'}
            size={22}
            color={indicatorColor}
          />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>Smart Connection</Text>
          <Text style={styles.level}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <View style={[styles.statusDot, { backgroundColor: indicatorColor }]} />
      </View>

      <View style={styles.metrics}>
        <Metric label="Connexion" value={level} accent={indicatorColor} />
        <Metric label="Qualité actuelle" value={quality} />
        <Metric label="Mode" value={qualityModeLabel(qualityMode)} />
      </View>

      {throughput ? (
        <Text style={[styles.throughput, { color: network.isStable ? colors.success : colors.textSecondary }]}>
          {throughput}
          {network.isStable ? ' · Stable' : ''}
        </Text>
      ) : (
        <Text style={styles.hint}>
          Qualité vidéo = piste active du lecteur (— hors lecture). Les modes ne règlent que le tampon.
        </Text>
      )}
    </GlassCard>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, accent ? { color: accent } : undefined]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    borderColor: colors.borderStrong,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1.5,
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
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
  },
  metrics: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metric: {
    flex: 1,
    gap: 2,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
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
