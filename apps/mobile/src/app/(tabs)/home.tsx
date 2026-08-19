import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Channel, HistoryEntry } from '@infiny-stream/types';
import { colors, elevation, radius, spacing, typography, type UniverseId, universeThemes } from '@/theme/tokens';
import { GlassCard } from '@/components/ui/GlassCard';
import { SmartConnectionCard } from '@/components/ui/SmartConnectionCard';
import { CardErrorBoundary } from '@/components/ui/CardErrorBoundary';
import { InfinyStreamLogo } from '@/components/brand/InfinyStreamLogo';
import { useSourcesStore } from '@/store/useSourcesStore';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import { useHistoryStore } from '@/store/useHistoryStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useSubscriptionStore } from '@/store/useSubscriptionStore';
import { listFavoriteChannels } from '@/services/favoritesHistoryRepository';
import { getKindCounts } from '@/services/channelsRepository';
import type { ContentKind } from '@infiny-stream/types';

const FAVORITE_LOGO_SIZE = 72;
const FAVORITE_ROW_LIMIT = 40;

export default function HomeScreen() {
  const sources = useSourcesStore((s) => s.sources);
  const loadSources = useSourcesStore((s) => s.load);
  const refreshSource = useSourcesStore((s) => s.refreshSource);
  const historyEntries = useHistoryStore((s) => s.entries);
  const loadHistory = useHistoryStore((s) => s.load);
  const favoriteCount = useFavoritesStore((s) => s.favoriteIds.size);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const subscriptionStatus = useSubscriptionStore((s) => s.status);
  const refreshSubscription = useSubscriptionStore((s) => s.refresh);
  const [favoriteChannels, setFavoriteChannels] = useState<Channel[]>([]);
  const [kindCounts, setKindCounts] = useState<Record<ContentKind, number>>({
    live: 0,
    movie: 0,
    series: 0,
    radio: 0,
  });
  const [refreshing, setRefreshing] = useState(false);

  const continueWatching = historyEntries[0];

  const reload = useCallback(async () => {
    await Promise.all([
      loadHistory(),
      listFavoriteChannels(FAVORITE_ROW_LIMIT).then(setFavoriteChannels),
      getKindCounts().then(setKindCounts),
      isAuthenticated ? refreshSubscription().catch(() => undefined) : Promise.resolve(),
    ]);
  }, [loadHistory, isAuthenticated, refreshSubscription]);

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

  function openUniverse(route: '/universe/live' | '/universe/movies' | '/universe/series' | '/universe/radios') {
    router.push(route);
  }

  const universeCards = [
    kindCounts.live > 0 && {
      universeId: 'live' as const,
      icon: 'tv-outline' as const,
      title: 'TV en direct',
      meta: `${kindCounts.live} chaîne${kindCounts.live === 1 ? '' : 's'}`,
      route: '/universe/live' as const,
    },
    kindCounts.movie > 0 && {
      universeId: 'movies' as const,
      icon: 'film-outline' as const,
      title: 'Films',
      meta: `${kindCounts.movie} film${kindCounts.movie === 1 ? '' : 's'}`,
      route: '/universe/movies' as const,
    },
    kindCounts.series > 0 && {
      universeId: 'series' as const,
      icon: 'albums-outline' as const,
      title: 'Séries',
      meta: `${kindCounts.series} entrée${kindCounts.series === 1 ? '' : 's'}`,
      route: '/universe/series' as const,
    },
    kindCounts.radio > 0 && {
      universeId: 'radios' as const,
      icon: 'radio-outline' as const,
      title: 'Radios',
      meta: `${kindCounts.radio} radio${kindCounts.radio === 1 ? '' : 's'}`,
      route: '/universe/radios' as const,
    },
  ].filter(Boolean) as Array<{
    universeId: UniverseId;
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    meta: string;
    route: '/universe/live' | '/universe/movies' | '/universe/series' | '/universe/radios';
  }>;

  return (
    <LinearGradient colors={[colors.background, colors.backgroundGlow, colors.background]} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.cyan} />}
        >
          <CardErrorBoundary name="header">
            <View style={styles.header}>
              <InfinyStreamLogo />
              <View style={styles.headerActions}>
                <HeaderIcon name="search-outline" onPress={() => router.push('/(tabs)/search')} />
                <HeaderIcon name="refresh-outline" onPress={onRefresh} />
                <HeaderIcon name="person-circle-outline" onPress={() => router.push('/account')} />
              </View>
            </View>
          </CardErrorBoundary>

          <CardErrorBoundary name="smart-connection">
            <SmartConnectionCard />
          </CardErrorBoundary>

          <CardErrorBoundary name="hero">
            {continueWatching ? <ContinueWatchingHero entry={continueWatching} /> : <WelcomeCard hasSources={sources.length > 0} />}
          </CardErrorBoundary>

          <CardErrorBoundary name="quick-access">
            <Section title="Accès rapides">
              <View style={styles.quickGrid}>
                {universeCards.map((card) => (
                  <QuickAccess
                    key={card.route}
                    universeId={card.universeId}
                    icon={card.icon}
                    title={card.title}
                    meta={card.meta}
                    onPress={() => openUniverse(card.route)}
                  />
                ))}
                <QuickAccess
                  universeId="favorites"
                  icon="heart-outline"
                  title="Favoris"
                  meta={favoriteCount > 0 ? `${favoriteCount}` : 'Aucun'}
                  onPress={() => router.push('/(tabs)/favorites')}
                />
                <QuickAccess
                  universeId="search"
                  icon="search-outline"
                  title="Recherche"
                  meta="Trouver une chaîne"
                  onPress={() => router.push('/(tabs)/search')}
                />
                <QuickAccess
                  universeId="search"
                  icon="albums-outline"
                  title="Mes playlists"
                  meta={sources.length > 0 ? `${sources.length}` : 'Ajouter'}
                  onPress={() => router.push(sources.length > 0 ? '/playlists' : '/add-source')}
                />
              </View>
            </Section>
          </CardErrorBoundary>

          {favoriteChannels.length > 0 && (
            <CardErrorBoundary name="favorites">
              <Section title="Vos chaînes favorites" action={{ label: 'Tout voir', onPress: () => router.push('/(tabs)/favorites') }}>
                <FlatList
                  horizontal
                  data={favoriteChannels}
                  keyExtractor={(item) => item.id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.favoriteRow}
                  nestedScrollEnabled
                  initialNumToRender={8}
                  maxToRenderPerBatch={8}
                  windowSize={5}
                  removeClippedSubviews
                  renderItem={({ item }) => (
                    <Pressable style={styles.favoriteTile} onPress={() => router.push(`/player/${item.id}`)}>
                      <View style={styles.favoriteLogoWrap}>
                        {item.logoUrl ? (
                          <Image
                            source={{ uri: item.logoUrl }}
                            style={styles.favoriteLogo}
                            contentFit="contain"
                            cachePolicy="disk"
                            recyclingKey={item.id}
                            transition={0}
                          />
                        ) : (
                          <Ionicons name="tv-outline" size={22} color={colors.textTertiary} />
                        )}
                      </View>
                      <Text numberOfLines={1} style={styles.favoriteName}>
                        {item.name}
                      </Text>
                    </Pressable>
                  )}
                />
              </Section>
            </CardErrorBoundary>
          )}

          {subscriptionStatus && (
            <CardErrorBoundary name="subscription">
              <Pressable onPress={() => router.push('/subscription')}>
                <GlassCard style={[styles.subscriptionCard, elevation.cardSubtle]}>
                  <View style={styles.subscriptionCopy}>
                    <Text style={styles.subscriptionKicker}>Abonnement</Text>
                    <Text style={styles.subscriptionTitle}>{subscriptionHeadline(subscriptionStatus.daysRemaining, subscriptionStatus.isTrial, subscriptionStatus.expired)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                </GlassCard>
              </Pressable>
            </CardErrorBoundary>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function subscriptionHeadline(daysRemaining: number, isTrial: boolean, expired: boolean): string {
  if (expired) return 'Essai terminé';
  if (isTrial) return `${daysRemaining} jour${daysRemaining === 1 ? '' : 's'} d’essai restants`;
  return `Expire dans ${daysRemaining} jour${daysRemaining === 1 ? '' : 's'}`;
}

function HeaderIcon({ name, onPress }: { name: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} style={styles.headerIcon}>
      <Ionicons name={name} size={22} color={colors.textPrimary} />
    </Pressable>
  );
}

function ContinueWatchingHero({ entry }: { entry: HistoryEntry }) {
  return (
    <Section title="Continuer à regarder">
      <Pressable onPress={() => router.push(`/player/${entry.channelId}`)}>
        <GlassCard style={[styles.heroCard, elevation.cardSubtle]}>
          <View style={styles.heroLogoWrap}>
            {entry.logoUrl ? (
              <Image source={{ uri: entry.logoUrl }} style={styles.heroLogo} contentFit="contain" cachePolicy="disk" transition={0} />
            ) : (
              <Ionicons name="tv-outline" size={28} color={colors.cyan} />
            )}
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroKicker}>Reprendre</Text>
            <Text numberOfLines={2} style={styles.heroTitle}>
              {entry.channelName}
            </Text>
          </View>
          <View style={styles.resumeButton}>
            <Ionicons name="play" size={18} color={colors.background} />
          </View>
        </GlassCard>
      </Pressable>
    </Section>
  );
}

function WelcomeCard({ hasSources }: { hasSources: boolean }) {
  return (
    <GlassCard style={[styles.welcomeCard, elevation.cardSubtle]}>
      <Text style={styles.welcomeTitle}>{hasSources ? 'Rien à reprendre pour le moment' : 'Bienvenue sur Infiny Stream'}</Text>
      <Text style={styles.welcomeBody}>
        {hasSources
          ? 'Lancez une chaîne pour la retrouver ici ensuite.'
          : 'Votre lecteur IPTV intelligent et fluide.'}
      </Text>
      {!hasSources && (
        <Pressable onPress={() => router.push('/add-source')} style={styles.welcomeAction}>
          <Text style={styles.welcomeActionLabel}>Ajouter une playlist</Text>
        </Pressable>
      )}
    </GlassCard>
  );
}

function QuickAccess({
  universeId,
  icon,
  title,
  meta,
  onPress,
}: {
  universeId: UniverseId;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  meta: string;
  onPress: () => void;
}) {
  const theme = universeThemes[universeId];

  return (
    <Pressable onPress={onPress} style={styles.quickItem}>
      <LinearGradient
        colors={[theme.gradient[0], theme.gradient[1]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.quickGradient, elevation.cardGlow(theme.glow)]}
      >
        <View style={[styles.quickIcon, { backgroundColor: `${theme.accent}22`, borderColor: `${theme.accent}55` }]}>
          <Ionicons name={icon} size={20} color={theme.accent} />
        </View>
        <Text style={styles.quickTitle}>{title}</Text>
        <Text style={styles.quickMeta}>{meta}</Text>
      </LinearGradient>
    </Pressable>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: { label: string; onPress: () => void };
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {action && (
          <Pressable onPress={action.onPress}>
            <Text style={styles.sectionAction}>{action.label}</Text>
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  scrollContent: { padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing.xxxl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceGlass,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.cardSubtle,
  },
  section: { gap: spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { ...typography.headline, color: colors.textPrimary },
  sectionAction: { ...typography.caption, color: colors.cyan },
  heroCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderColor: colors.borderStrong },
  heroLogoWrap: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroLogo: { width: 56, height: 56 },
  heroCopy: { flex: 1, gap: 2 },
  heroKicker: { ...typography.label, color: colors.cyan },
  heroTitle: { ...typography.headline, color: colors.textPrimary },
  resumeButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeCard: { gap: spacing.sm, borderColor: colors.borderStrong },
  welcomeTitle: { ...typography.headline, color: colors.textPrimary },
  welcomeBody: { ...typography.body, color: colors.textSecondary },
  welcomeAction: { alignSelf: 'flex-start', marginTop: spacing.xs },
  welcomeActionLabel: { ...typography.bodyStrong, color: colors.cyan },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  quickItem: { width: '48%', flexGrow: 1 },
  quickGradient: {
    gap: spacing.sm,
    minHeight: 108,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
  },
  quickIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickTitle: { ...typography.bodyStrong, color: colors.textPrimary },
  quickMeta: { ...typography.caption, color: colors.textSecondary },
  favoriteRow: { gap: spacing.md, paddingRight: spacing.md },
  favoriteTile: { width: FAVORITE_LOGO_SIZE, gap: spacing.xs },
  favoriteLogoWrap: {
    width: FAVORITE_LOGO_SIZE,
    height: FAVORITE_LOGO_SIZE,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceGlass,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...elevation.cardSubtle,
  },
  favoriteLogo: { width: FAVORITE_LOGO_SIZE - 16, height: FAVORITE_LOGO_SIZE - 16 },
  favoriteName: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
  subscriptionCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderColor: colors.borderStrong },
  subscriptionCopy: { flex: 1, gap: 2 },
  subscriptionKicker: { ...typography.label, color: colors.textTertiary },
  subscriptionTitle: { ...typography.bodyStrong, color: colors.textPrimary },
});
