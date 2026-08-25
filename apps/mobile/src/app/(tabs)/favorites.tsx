import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text } from 'react-native';
import { ScreenSafeArea } from '@/components/ui/ScreenSafeArea';
import { router, useFocusEffect } from 'expo-router';
import type { GroupedChannel } from '@infiny-stream/types';
import { colors, spacing, typography } from '@/theme/tokens';
import { ChannelRow } from '@/components/ui/ChannelRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { listFavoriteChannels } from '@/services/favoritesHistoryRepository';
import { groupedFromChannels, groupFavoriteChannel } from '@/services/channelGroups';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import { useParentalStore } from '@/store/useParentalStore';

export default function FavoritesScreen() {
  const [groups, setGroups] = useState<GroupedChannel[]>([]);
  const toggleFavorite = useFavoritesStore((s) => s.toggle);
  const unlocked = useParentalStore((s) => s.unlocked);
  const pinConfigured = useParentalStore((s) => s.pinConfigured);
  const includeAdult = pinConfigured && unlocked;

  const reload = useCallback(() => {
    listFavoriteChannels(500, includeAdult).then((rows) => setGroups(groupedFromChannels(rows)));
  }, [includeAdult]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  return (
    <ScreenSafeArea style={styles.safeArea}>
      <Text style={styles.title}>Favoris</Text>

      {groups.length === 0 ? (
        <EmptyState icon="heart-outline" title="Aucun favori" message="Appuyez sur le cœur d'une chaîne pour l'ajouter ici." />
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const target = groupFavoriteChannel(item);
            return (
              <ChannelRow
                group={item}
                isFavorite
                onPress={() => router.push(`/player/${target.id}`)}
                onToggleFavorite={async () => {
                  await toggleFavorite(target.id, target.sourceId);
                  reload();
                }}
              />
            );
          }}
        />
      )}
    </ScreenSafeArea>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  title: { ...typography.title, color: colors.textPrimary, paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.md },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxxl },
});
