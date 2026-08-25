import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/theme/tokens';

interface UniverseHeaderProps {
  title: string;
  onBack?: () => void;
}

export function UniverseHeader({ title, onBack }: UniverseHeaderProps) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack ?? (() => router.back())} hitSlop={12}>
        <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
      </Pressable>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={{ width: 24 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  title: { ...typography.headline, color: colors.textPrimary, flex: 1, textAlign: 'center' },
});
