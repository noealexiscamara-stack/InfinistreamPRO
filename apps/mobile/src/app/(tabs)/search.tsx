import { useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Channel } from '@infiny-stream/types';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { TextField } from '@/components/ui/TextField';
import { ChannelRow } from '@/components/ui/ChannelRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { searchChannels } from '@/services/channelsRepository';
import { useFavoritesStore } from '@/store/useFavoritesStore';

const DEBOUNCE_MS = 250;

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Channel[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const toggleFavorite = useFavoritesStore((s) => s.toggle);
  const isFavorite = useFavoritesStore((s) => s.isFavorite);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    debounceTimer.current = setTimeout(async () => {
      const matches = await searchChannels(null, trimmed);
      setResults(matches);
      setHasSearched(true);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Recherche</Text>
        <TextField
          label=""
          placeholder="Nom, groupe, pays…"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
      </View>

      {hasSearched && results.length === 0 && (
        <EmptyState icon="search-outline" title="Aucun résultat" message="Essayez un autre nom, groupe ou pays." />
      )}

      {!hasSearched && (
        <View style={styles.hint}>
          <Ionicons name="search-outline" size={32} color={colors.textTertiary} />
          <Text style={styles.hintText}>Recherchez parmi toutes vos playlists à la fois.</Text>
        </View>
      )}

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <ChannelRow
            channel={item}
            isFavorite={isFavorite(item.id)}
            onPress={() => router.push(`/player/${item.id}`)}
            onToggleFavorite={() => toggleFavorite(item.id, item.sourceId)}
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, gap: spacing.md },
  title: { ...typography.title, color: colors.textPrimary },
  input: { borderRadius: radius.pill },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxxl },
  hint: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.xxxl },
  hintText: { ...typography.body, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: spacing.xxxl },
});
