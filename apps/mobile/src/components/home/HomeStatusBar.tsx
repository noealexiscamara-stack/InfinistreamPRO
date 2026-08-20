import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, networkQualityColor, radius, spacing, typography } from '@/theme/tokens';
import { useNetworkState } from '@/store/useNetworkStore';
import { connectionLevelLabel } from '@/utils/networkDisplay';
import { formatPlaybackHeight, usePlaybackQualityStore } from '@/store/usePlaybackQualityStore';
import { API_URL } from '@/config/env';
import { useRadioPlayback } from '@/services/playback/RadioPlaybackProvider';

interface HomeStatusBarProps {
  scale?: number;
  dense?: boolean;
}

/**
 * Honest status strip — no marketing claims presented as live facts.
 * "Qualité actuelle" is the active expo-video track height, or "—" off-player.
 * Offline comes only from system connectivity, never from throughput.
 */
export function HomeStatusBar({ scale = 1, dense = false }: HomeStatusBarProps) {
  const network = useNetworkState();
  const { activeChannel } = useRadioPlayback();
  const playbackHeight = usePlaybackQualityStore((s) => s.height);
  const playing = Boolean(activeChannel);
  const connection = connectionLevelLabel(network);
  const connectionColor = networkQualityColor[network.quality];

  const quality = formatPlaybackHeight(playbackHeight);

  const adaptation =
    network.quality === 'offline'
      ? 'Hors ligne'
      : network.quality === 'unknown'
        ? '—'
        : network.isStable || network.connectionType === 'wifi' || network.connectionType === 'ethernet'
          ? 'Réseau optimisé'
          : 'Adaptation en cours';

  const secure = API_URL.startsWith('https://');

  const items: StatusItem[] = [
    {
      key: 'conn',
      icon: network.quality === 'offline' ? 'cloud-offline-outline' : 'wifi',
      label: 'Connexion',
      value: connection,
      color: connectionColor,
    },
    {
      key: 'quality',
      icon: 'videocam-outline',
      label: 'Qualité actuelle',
      value: quality,
      color: quality === '—' ? colors.textTertiary : colors.textPrimary,
    },
    {
      key: 'adapt',
      icon: 'pulse-outline',
      label: 'Adaptation',
      value: adaptation,
      color: colors.textSecondary,
    },
  ];

  if (secure) {
    items.push({
      key: 'secure',
      icon: 'shield-checkmark-outline',
      label: 'Sécurisé',
      value: 'API en HTTPS',
      color: colors.success,
    });
  }

  items.push({
    key: 'play',
    icon: playing ? 'play-circle-outline' : 'pause-circle-outline',
    label: 'Lecture',
    value: playing && activeChannel ? (dense ? 'En cours' : activeChannel.name) : 'Aucune en cours',
    color: colors.textSecondary,
  });

  return (
    <View style={[styles.row, dense && styles.rowDense]}>
      {items.map((item) => (
        <View key={item.key} style={styles.item}>
          <Ionicons name={item.icon} size={Math.round(14 * scale)} color={item.color} />
          <View style={styles.copy}>
            <Text style={[styles.label, { fontSize: Math.round(9 * scale) }]}>{item.label}</Text>
            <Text style={[styles.value, { color: item.color, fontSize: Math.round(11 * scale) }]} numberOfLines={1}>
              {item.value}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

interface StatusItem {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  color: string;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceGlass,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  rowDense: {
    paddingVertical: spacing.xs,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
    minWidth: 0,
    paddingHorizontal: spacing.xs,
  },
  copy: { flex: 1, gap: 1, minWidth: 0 },
  label: { ...typography.caption, color: colors.textTertiary },
  value: { ...typography.caption, fontWeight: '600' },
});
