import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { Channel } from '@infiny-stream/types';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { EmptyState } from '@/components/ui/EmptyState';
import { UniverseHeader } from '@/components/universe/UniverseHeader';
import { getAllChannelsByKind } from '@/services/channelsRepository';
import { useFavoritesStore } from '@/store/useFavoritesStore';

export default function RadiosUniverseScreen() {
  const [radios, setRadios] = useState<Channel[]>([]);
  const toggleFavorite = useFavoritesStore((s) => s.toggle);
  const isFavorite = useFavoritesStore((s) => s.isFavorite);

  const reload = useCallback(() => {
    getAllChannelsByKind('radio', 10000).then(setRadios);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <UniverseHeader title="Radios" />

      {radios.length === 0 ? (
        <EmptyState icon="radio-outline" title="Aucune radio" message="Les radios de vos playlists apparaîtront ici." />
      ) : (
        <FlatList
          data={radios}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          initialNumToRender={24}
          maxToRenderPerBatch={24}
          windowSize={7}
          removeClippedSubviews
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => router.push(`/player/${item.id}`)}>
              <View style={styles.logoWrap}>
                {item.logoUrl ? (
                  <Image source={{ uri: item.logoUrl }} style={styles.logo} contentFit="contain" cachePolicy="disk" />
                ) : (
                  <Ionicons name="radio-outline" size={20} color={colors.textTertiary} />
                )}
              </View>
              <View style={styles.copy}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name}
                </Text>
                {!!item.groupTitle && (
                  <Text style={styles.meta} numberOfLines={1}>
                    {item.groupTitle}
                  </Text>
                )}
              </View>
              <Pressable hitSlop={12} onPress={() => toggleFavorite(item.id, item.sourceId)}>
                <Ionicons
                  name={isFavorite(item.id) ? 'heart' : 'heart-outline'}
                  size={20}
                  color={isFavorite(item.id) ? colors.brand : colors.textTertiary}
                />
              </Pressable>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxxl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  logoWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: { width: 32, height: 32 },
  copy: { flex: 1 },
  name: { ...typography.bodyStrong, color: colors.textPrimary },
  meta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
});
