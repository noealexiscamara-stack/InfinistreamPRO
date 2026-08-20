import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import type { ContentKind } from '@infiny-stream/types';
import { colors, elevation, spacing, typography } from '@/theme/tokens';
import { GlassCard } from '@/components/ui/GlassCard';
import { CardErrorBoundary } from '@/components/ui/CardErrorBoundary';
import { HomeHeader } from '@/components/home/HomeHeader';
import { WelcomeTitle } from '@/components/home/WelcomeTitle';
import { AddIptvCard } from '@/components/home/AddIptvCard';
import { ContinueWatchingCard } from '@/components/home/ContinueWatchingCard';
import { PhonePairingCard } from '@/components/home/PhonePairingCard';
import { QuickFunctions, buildDefaultQuickFunctions } from '@/components/home/QuickFunctions';
import { HomeStatusBar } from '@/components/home/HomeStatusBar';
import { useSourcesStore } from '@/store/useSourcesStore';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import { useHistoryStore } from '@/store/useHistoryStore';
import { getKindCounts } from '@/services/channelsRepository';

/** Reference width for the TV mockup; phone landscape scales down from this. */
const LAYOUT_REF_WIDTH = 960;

export default function HomeScreen() {
  const { width, height } = useWindowDimensions();
  const scale = useMemo(() => Math.min(1, Math.max(0.72, width / LAYOUT_REF_WIDTH)), [width]);
  const dense = height < 500;

  const sources = useSourcesStore((s) => s.sources);
  const loadSources = useSourcesStore((s) => s.load);
  const refreshSource = useSourcesStore((s) => s.refreshSource);
  const loadHistory = useHistoryStore((s) => s.load);
  const entries = useHistoryStore((s) => s.entries);
  const favoriteCount = useFavoritesStore((s) => s.favoriteIds.size);
  const [kindCounts, setKindCounts] = useState<Record<ContentKind, number>>({
    live: 0,
    movie: 0,
    series: 0,
    radio: 0,
  });
  const [refreshing, setRefreshing] = useState(false);

  const hasSources = sources.length > 0;
  const continueWatching = entries[0];

  const reload = useCallback(async () => {
    await Promise.all([loadHistory(), getKindCounts().then(setKindCounts)]);
  }, [loadHistory]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all(sources.map((s) => refreshSource(s.id).catch(() => undefined)));
    await reload();
    setRefreshing(false);
  }

  const quickItems = buildDefaultQuickFunctions({
    liveCount: kindCounts.live,
    movieCount: kindCounts.movie,
    seriesCount: kindCounts.series,
    favoriteCount,
  });

  return (
    <LinearGradient colors={[colors.background, colors.backgroundGlow, colors.background]} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            dense && styles.scrollDense,
            { gap: dense ? spacing.md : spacing.lg * scale },
          ]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.cyan} />}
        >
          <CardErrorBoundary name="header">
            <HomeHeader scale={scale} />
          </CardErrorBoundary>

          <CardErrorBoundary name="welcome">
            <WelcomeTitle scale={scale} />
          </CardErrorBoundary>

          <CardErrorBoundary name="hero-cards">
            <View style={styles.cardsRow}>
              {!hasSources ? (
                <AddIptvCard scale={scale} />
              ) : continueWatching ? (
                <ContinueWatchingCard entry={continueWatching} />
              ) : (
                <GlassCard style={[styles.emptyContinue, elevation.cardSubtle]}>
                  <Text style={styles.emptyTitle}>Rien à reprendre pour le moment</Text>
                  <Text style={styles.emptyBody}>Lancez une chaîne pour la retrouver ici ensuite.</Text>
                </GlassCard>
              )}
              <PhonePairingCard scale={scale} dense={dense} />
            </View>
          </CardErrorBoundary>

          <CardErrorBoundary name="quick-functions">
            <QuickFunctions items={quickItems} scale={scale} dense={dense} />
          </CardErrorBoundary>

          <CardErrorBoundary name="status-bar">
            <HomeStatusBar scale={scale} dense={dense} />
          </CardErrorBoundary>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  scrollDense: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  cardsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.md,
  },
  emptyContinue: { gap: spacing.sm, borderColor: colors.borderStrong, flex: 1 },
  emptyTitle: { ...typography.headline, color: colors.textPrimary },
  emptyBody: { ...typography.body, color: colors.textSecondary },
});
