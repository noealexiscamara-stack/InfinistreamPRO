import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import type { Channel } from '@infiny-stream/types';
import { colors, spacing, typography } from '@/theme/tokens';
import { ChannelRow } from '@/components/ui/ChannelRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { listFavoriteChannels } from '@/services/favoritesHistoryRepository';
import { useFavoritesStore } from '@/store/useFavoritesStore';

export default function FavoritesScreen() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const toggleFavorite = useFavoritesStore((s) => s.toggle);

  const reload = useCallback(() => {
    listFavoriteChannels(500).then(setChannels);
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Text style={styles.title}>Favoris</Text>

      {channels.length === 0 ? (
        <EmptyState icon="heart-outline" title="Aucun favori" message="Appuyez sur le cœur d'une chaîne pour l'ajouter ici." />
      ) : (
        <FlatList
          data={channels}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <ChannelRow
              channel={item}
              isFavorite
              onPress={() => router.push(`/player/${item.id}`)}
              onToggleFavorite={async () => {
                await toggleFavorite(item.id, item.sourceId);
                reload();
              }}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  title: { ...typography.title, color: colors.textPrimary, paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.md },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxxl },
});
