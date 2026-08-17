import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView, type VideoPlayerStatus } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import type { Channel } from '@infiny-stream/types';
import { NETWORK_QUALITY_LABELS } from '@infiny-stream/types';
import { colors, networkQualityColor, radius, spacing, typography } from '@/theme/tokens';
import { getChannelById, getChannels } from '@/services/channelsRepository';
import { recordHistory } from '@/services/favoritesHistoryRepository';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { PlayerController } from '@/services/playback/PlayerController';

type PlayerScreenState = 'loading' | 'playing' | 'reconnecting' | 'error';

export default function PlayerScreen() {
  const { channelId } = useLocalSearchParams<{ channelId: string }>();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [siblings, setSiblings] = useState<Channel[]>([]);
  const [screenState, setScreenState] = useState<PlayerScreenState>('loading');
  const [networkLabel, setNetworkLabel] = useState<{ quality: keyof typeof networkQualityColor; text: string }>({
    quality: 'medium',
    text: 'Mesure en cours…',
  });
  const [controlsVisible, setControlsVisible] = useState(true);

  const qualityMode = useSettingsStore((s) => s.qualityMode);
  const setQualityMode = useSettingsStore((s) => s.setQualityMode);
  const toggleFavorite = useFavoritesStore((s) => s.toggle);
  const isFavorite = useFavoritesStore((s) => s.isFavorite);

  const player = useVideoPlayer(null, (p) => {
    p.loop = false;
  });
  const controllerRef = useRef<PlayerController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = new PlayerController(player);
  }

  // --- Load channel metadata + its siblings (for prev/next) ---
  useEffect(() => {
    if (!channelId) return;
    let cancelled = false;

    (async () => {
      const ch = await getChannelById(channelId);
      if (cancelled || !ch) return;
      setChannel(ch);
      const list = await getChannels(ch.sourceId, { limit: 5000 });
      if (!cancelled) setSiblings(list);
    })();

    return () => {
      cancelled = true;
    };
  }, [channelId]);

  // --- Drive PlayerController once we know the channel ---
  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller || !channel) return;

    controller.setCallbacks({
      onNetworkStateChange: (state) => {
        setNetworkLabel({ quality: state.quality, text: NETWORK_QUALITY_LABELS[state.quality] });
      },
      onReconnecting: () => setScreenState('reconnecting'),
      onReconnected: () => setScreenState('playing'),
      onFatalError: () => setScreenState('error'),
    });
    controller.setMode(qualityMode);
    setScreenState('loading');
    controller.loadChannel(channel.streamUrl).then(() => setScreenState('playing'));

    recordHistory({ channelId: channel.id, sourceId: channel.sourceId, channelName: channel.name, logoUrl: channel.logoUrl });

    return () => {
      controller.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel?.id]);

  useEffect(() => {
    controllerRef.current?.setMode(qualityMode);
  }, [qualityMode]);

  // --- Player status -> stall/error detection ---
  useEffect(() => {
    const sub = player.addListener('statusChange', (event: { status: VideoPlayerStatus }) => {
      if (event.status === 'error') {
        controllerRef.current?.handlePlaybackError('source');
      }
    });
    return () => sub.remove();
  }, [player]);

  const currentIndex = useMemo(() => siblings.findIndex((c) => c.id === channel?.id), [siblings, channel]);

  const goToSibling = useCallback(
    (direction: 1 | -1) => {
      if (siblings.length === 0 || currentIndex === -1) return;
      const nextIndex = (currentIndex + direction + siblings.length) % siblings.length;
      router.replace(`/player/${siblings[nextIndex].id}`);
    },
    [siblings, currentIndex]
  );

  function handleRetry() {
    if (!channel) return;
    setScreenState('loading');
    controllerRef.current?.loadChannel(channel.streamUrl).then(() => setScreenState('playing'));
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <Pressable style={styles.videoWrap} onPress={() => setControlsVisible((v) => !v)}>
        <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />

        {screenState === 'error' && (
          <View style={styles.overlay}>
            <Ionicons name="alert-circle-outline" size={40} color={colors.danger} />
            <Text style={styles.overlayTitle}>Impossible de lire cette chaîne.</Text>
            <View style={styles.overlayActions}>
              <Pressable style={styles.overlayButton} onPress={handleRetry}>
                <Text style={styles.overlayButtonLabel}>Réessayer</Text>
              </Pressable>
              <Pressable style={[styles.overlayButton, styles.overlayButtonGhost]} onPress={() => router.back()}>
                <Text style={styles.overlayButtonLabel}>Retour</Text>
              </Pressable>
            </View>
          </View>
        )}

        {(screenState === 'loading' || screenState === 'reconnecting') && (
          <View style={styles.overlay}>
            <Text style={styles.overlayTitle}>{screenState === 'reconnecting' ? 'Reconnexion…' : 'Chargement…'}</Text>
          </View>
        )}

        {controlsVisible && screenState !== 'error' && (
          <View style={styles.controls} pointerEvents="box-none">
            <View style={styles.topBar}>
              <Pressable onPress={() => router.back()} hitSlop={12}>
                <Ionicons name="chevron-down" size={26} color={colors.textPrimary} />
              </Pressable>
              <View style={styles.channelInfo}>
                <Text style={styles.channelName} numberOfLines={1}>
                  {channel?.name}
                </Text>
                <View style={styles.networkRow}>
                  <View style={[styles.dot, { backgroundColor: networkQualityColor[networkLabel.quality] }]} />
                  <Text style={styles.networkText}>{networkLabel.text}</Text>
                </View>
              </View>
              {channel && (
                <Pressable onPress={() => toggleFavorite(channel.id, channel.sourceId)} hitSlop={12}>
                  <Ionicons
                    name={isFavorite(channel.id) ? 'heart' : 'heart-outline'}
                    size={24}
                    color={isFavorite(channel.id) ? colors.brand : colors.textPrimary}
                  />
                </Pressable>
              )}
            </View>

            <View style={styles.bottomBar}>
              <Pressable style={styles.controlButton} onPress={() => goToSibling(-1)} hitSlop={12}>
                <Ionicons name="play-skip-back" size={26} color={colors.textPrimary} />
              </Pressable>
              <Pressable
                style={styles.playButton}
                onPress={() => (player.playing ? player.pause() : player.play())}
                hitSlop={12}
              >
                <Ionicons name={player.playing ? 'pause' : 'play'} size={30} color={colors.textPrimary} />
              </Pressable>
              <Pressable style={styles.controlButton} onPress={() => goToSibling(1)} hitSlop={12}>
                <Ionicons name="play-skip-forward" size={26} color={colors.textPrimary} />
              </Pressable>
            </View>
          </View>
        )}
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#000' },
  videoWrap: { flex: 1, backgroundColor: '#000' },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  overlayTitle: { ...typography.headline, color: colors.textPrimary, textAlign: 'center', paddingHorizontal: spacing.xl },
  overlayActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  overlayButton: { backgroundColor: colors.brand, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.md },
  overlayButtonGhost: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  overlayButtonLabel: { ...typography.bodyStrong, color: colors.textPrimary },
  controls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  channelInfo: { flex: 1 },
  channelName: { ...typography.headline, color: colors.textPrimary },
  networkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  networkText: { ...typography.caption, color: colors.textSecondary },
  bottomBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xxl },
  controlButton: { padding: spacing.sm },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
