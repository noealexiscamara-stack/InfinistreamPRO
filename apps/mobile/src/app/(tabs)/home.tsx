import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ContentKind } from '@infiny-stream/types';
import { colors, elevation, spacing, typography } from '@/theme/tokens';
import { GlassCard } from '@/components/ui/GlassCard';
import { CardErrorBoundary } from '@/components/ui/CardErrorBoundary';
import { ScreenSafeArea } from '@/components/ui/ScreenSafeArea';
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

const LAYOUT_REF_WIDTH = 960;
/** Target content stack height in landscape — scale down when the viewport is shorter. */
const LAYOUT_REF_HEIGHT = 420;

export default function HomeScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const availableHeight = height - insets.top - insets.bottom;
  const widthScale = Math.min(1, Math.max(0.72, width / LAYOUT_REF_WIDTH));
  const heightScale = Math.min(1, Math.max(0.58, availableHeight / LAYOUT_REF_HEIGHT));
  const scale = Math.min(widthScale, heightScale);
  const dense = availableHeight < 420;

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

  const gap = Math.round((dense ? spacing.sm : spacing.md) * scale);
  const padH = Math.round((dense ? spacing.md : spacing.lg) * scale);
  const padV = Math.round((dense ? spacing.xs : spacing.sm) * scale);

  return (
    <LinearGradient colors={[colors.background, colors.backgroundGlow, colors.background]} style={styles.gradient}>
      <ScreenSafeArea style={styles.safeArea}>
        <View style={[styles.page, { paddingHorizontal: padH, paddingVertical: padV, gap }]}>
          <CardErrorBoundary name="header">
            <HomeHeader scale={scale} />
          </CardErrorBoundary>

          {!dense && (
            <CardErrorBoundary name="welcome">
              <WelcomeTitle scale={scale} />
            </CardErrorBoundary>
          )}

          <CardErrorBoundary name="hero-cards">
            <View style={[styles.cardsRow, { flex: 1, minHeight: 0, gap }]}>
              {!hasSources ? (
                <AddIptvCard scale={scale} />
              ) : continueWatching ? (
                <ContinueWatchingCard entry={continueWatching} scale={scale} dense={dense} />
              ) : (
                <GlassCard style={[styles.emptyContinue, elevation.cardSubtle, { flex: 1 }]}>
                  <Text style={[styles.emptyTitle, { fontSize: Math.round(16 * scale) }]}>Rien à reprendre</Text>
                  <Text style={[styles.emptyBody, { fontSize: Math.round(13 * scale) }]}>
                    Lancez une chaîne pour la retrouver ici.
                  </Text>
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

          <Pressable onPress={() => void onRefresh()} style={styles.refreshHint} hitSlop={8}>
            <Ionicons name={refreshing ? 'sync' : 'refresh-outline'} size={14} color={colors.textTertiary} />
            <Text style={styles.refreshLabel}>{refreshing ? 'Actualisation…' : 'Actualiser'}</Text>
          </Pressable>
        </View>
      </ScreenSafeArea>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  page: {
    flex: 1,
    justifyContent: 'space-between',
  },
  cardsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  emptyContinue: { gap: spacing.sm, borderColor: colors.borderStrong, justifyContent: 'center' },
  emptyTitle: { ...typography.headline, color: colors.textPrimary },
  emptyBody: { ...typography.body, color: colors.textSecondary },
  refreshHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    opacity: 0.7,
  },
  refreshLabel: { ...typography.caption, color: colors.textTertiary },
});
