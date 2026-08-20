import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, elevation, networkQualityColor, radius, spacing, typography } from '@/theme/tokens';
import { InfinyStreamLogo } from '@/components/brand/InfinyStreamLogo';
import { useNetworkState } from '@/store/useNetworkStore';
import { connectionDisplay } from '@/utils/networkDisplay';
import { ClockLabel } from '@/components/home/useClock';

interface HomeHeaderProps {
  scale?: number;
}

export function HomeHeader({ scale = 1 }: HomeHeaderProps) {
  const network = useNetworkState();
  const { title, subtitle } = connectionDisplay(network);
  const indicatorColor = networkQualityColor[network.quality];
  const iconSize = Math.round(36 * scale);

  return (
    <View style={styles.row}>
      <InfinyStreamLogo />

      <View style={styles.right}>
        <View style={styles.connection}>
          <View style={[styles.dot, { backgroundColor: indicatorColor }]} />
          <View>
            <Text style={[styles.connTitle, { fontSize: 13 * scale }]} numberOfLines={1}>
              {title}
            </Text>
            <Text style={[styles.connSub, { fontSize: 11 * scale }]} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
        </View>

        <ClockLabel />

        <HeaderIcon name="search-outline" size={iconSize} onPress={() => router.push('/(tabs)/search')} />
        <HeaderIcon name="settings-outline" size={iconSize} onPress={() => router.push('/(tabs)/settings')} />
        <HeaderIcon name="person-circle-outline" size={iconSize} onPress={() => router.push('/account')} />
      </View>
    </View>
  );
}

function HeaderIcon({
  name,
  onPress,
  size,
}: {
  name: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  size: number;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={[styles.iconBtn, { width: size, height: size }]}>
      <Ionicons name={name} size={Math.round(size * 0.55)} color={colors.textPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  connection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    maxWidth: 160,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
  },
  connTitle: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  connSub: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  iconBtn: {
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceGlass,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.cardSubtle,
  },
});
