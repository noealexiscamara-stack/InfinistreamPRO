import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { GroupedChannel } from '@infiny-stream/types';
import { colors, radius, spacing, typography } from '@/theme/tokens';

interface PlayerChannelPickerProps {
  visible: boolean;
  channels: GroupedChannel[];
  activeChannelId?: string;
  onClose: () => void;
  onSelect: (group: GroupedChannel) => void;
}

export function PlayerChannelPicker({
  visible,
  channels,
  activeChannelId,
  onClose,
  onSelect,
}: PlayerChannelPickerProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.dismissArea} onPress={onClose} accessibilityLabel="Fermer la liste" />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Chaînes</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </Pressable>
          </View>
          <FlatList
            data={channels}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const active = item.tiers.some((tier) => tier.channel.id === activeChannelId);
              const number = item.sortIndex + 1;
              return (
                <Pressable
                  style={[styles.row, active && styles.rowActive]}
                  onPress={() => onSelect(item)}
                >
                  <Text style={[styles.number, active && styles.numberActive]}>{number}</Text>
                  {item.logoUrl ? (
                    <Image source={{ uri: item.logoUrl }} style={styles.logo} contentFit="contain" cachePolicy="disk" />
                  ) : (
                    <View style={styles.logoFallback}>
                      <Ionicons name="tv-outline" size={18} color={colors.textTertiary} />
                    </View>
                  )}
                  <Text style={[styles.name, active && styles.nameActive]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {active && <Ionicons name="play" size={16} color={colors.brand} />}
                </Pressable>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  dismissArea: {
    flex: 1,
  },
  sheet: {
    width: '42%',
    minWidth: 280,
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    ...typography.headline,
    color: colors.textPrimary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  rowActive: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  number: {
    ...typography.caption,
    color: colors.textSecondary,
    width: 36,
    fontVariant: ['tabular-nums'],
  },
  numberActive: {
    color: colors.brand,
    fontWeight: '700',
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
  },
  logoFallback: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  nameActive: {
    color: colors.brand,
    fontWeight: '600',
  },
});
