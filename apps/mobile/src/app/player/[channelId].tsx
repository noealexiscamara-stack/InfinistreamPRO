import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenSafeArea } from '@/components/ui/ScreenSafeArea';
import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView, type VideoPlayerStatus } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import type { Channel, GroupedChannel } from '@infiny-stream/types';
import { colors, networkQualityColor, radius, spacing, typography } from '@/theme/tokens';
import { getChannelById, getChannels } from '@/services/channelsRepository';
import { findGroupContaining, groupedFromChannels } from '@/services/channelGroups';
import { recordHistory } from '@/services/favoritesHistoryRepository';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useNetworkState } from '@/store/useNetworkStore';
import { PlayerController } from '@/services/playback/PlayerController';
import { isXtreamSeriesPlaceholder } from '@/services/persistChannels';
import { useRadioPlayback } from '@/services/playback/RadioPlaybackProvider';
import { connectionLevelLabel } from '@/utils/networkDisplay';
import { formatPlaybackHeight, usePlaybackQualityStore } from '@/store/usePlaybackQualityStore';

type PlayerScreenState = 'loading' | 'playing' | 'reconnecting' | 'error';

export default function PlayerScreen() {
  const { channelId: rawChannelId } = useLocalSearchParams<{ channelId: string }>();
  const channelId = Array.isArray(rawChannelId) ? rawChannelId[0] : rawChannelId;

  const [channel, setChannel] = useState<Channel | null>(null);
  const [group, setGroup] = useState<GroupedChannel | null>(null);
  const [siblings, setSiblings] = useState<GroupedChannel[]>([]);
  const [screenState, setScreenState] = useState<PlayerScreenState>('loading');
  const [controlsVisible, setControlsVisible] = useState(true);

  const qualityMode = useSettingsStore((s) => s.qualityMode);
  const networkState = useNetworkState();
  const playbackHeight = usePlaybackQualityStore((s) => s.height);
  const setPlaybackHeight = usePlaybackQualityStore((s) => s.setHeight);
  const clearPlaybackQuality = usePlaybackQualityStore((s) => s.clear);
  const toggleFavorite = useFavoritesStore((s) => s.toggle);
  const isFavorite = useFavoritesStore((s) => s.isFavorite);
  const { playRadio, stopRadio, activeChannel: activeRadio } = useRadioPlayback();

  const player = useVideoPlayer(null, (p) => {
    p.loop = false;
  });

  const controllerRef = useRef<PlayerController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = new PlayerController(player);
  }

  useEffect(() => {
    return () => {
      clearPlaybackQuality();
      controllerRef.current?.dispose();
      controllerRef.current = null;
    };
  }, [clearPlaybackQuality]);

  useEffect(() => {
    if (!channelId) return;
    let cancelled = false;
    const controller = controllerRef.current;
    if (!controller) return;

    (async () => {
      setScreenState('loading');
      setChannel(null);
      setGroup(null);
      setSiblings([]);

      const ch = await getChannelById(channelId);
      if (cancelled) return;
      if (!ch) {
        setScreenState('error');
        return;
      }
      if (isXtreamSeriesPlaceholder(ch.streamUrl)) {
        router.replace(`/universe/series/${ch.id}`);
        return;
      }
      setChannel(ch);

      let streamUrl = ch.streamUrl;
      let activeGroup: GroupedChannel | null = null;
      let siblingGroups: GroupedChannel[] = [];

      const isLive = !ch.kind || ch.kind === 'live';
      if (isLive) {
        const list = await getChannels(ch.sourceId, { kind: 'live', limit: 10000 });
        if (cancelled) return;
        siblingGroups = groupedFromChannels(list);
        activeGroup = findGroupContaining(siblingGroups, ch.id) ?? null;
        setSiblings(siblingGroups);
        setGroup(activeGroup);
        controller.setMode(qualityMode);
        if (activeGroup) {
          streamUrl = controller.attachChannelGroup(activeGroup);
        }
      }

      if (cancelled) return;

      if (ch.kind === 'radio') {
        playRadio(ch);
        setScreenState('playing');
        recordHistory({
          channelId: ch.id,
          sourceId: ch.sourceId,
          channelName: ch.name,
          logoUrl: ch.logoUrl,
        });
        return;
      }

      stopRadio();

      controller.setCallbacks({
        onReconnecting: () => setScreenState('reconnecting'),
        onReconnected: () => setScreenState('playing'),
        onFatalError: () => setScreenState('error'),
      });
      if (!isLive) {
        controller.setMode(qualityMode);
      }

      try {
        await controller.loadChannel(streamUrl);
        if (!cancelled) setScreenState('playing');
      } catch {
        if (!cancelled) setScreenState('error');
      }

      recordHistory({
        channelId: ch.id,
        sourceId: ch.sourceId,
        channelName: activeGroup?.name ?? ch.name,
        logoUrl: activeGroup?.logoUrl ?? ch.logoUrl,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [channelId, playRadio, stopRadio]);

  useEffect(() => {
    controllerRef.current?.setMode(qualityMode);
  }, [qualityMode]);

  useEffect(() => {
    const statusSub = player.addListener('statusChange', (event: { status: VideoPlayerStatus }) => {
      if (event.status === 'error') {
        controllerRef.current?.handlePlaybackError('source');
      }
    });
    const trackSub = player.addListener(
      'videoTrackChange',
      (event: { videoTrack: { size?: { height?: number } } | null }) => {
        const height = event.videoTrack?.size?.height;
        setPlaybackHeight(typeof height === 'number' && height > 0 ? height : null);
      }
    );
    return () => {
      statusSub.remove();
      trackSub.remove();
    };
  }, [player, setPlaybackHeight]);

  const currentIndex = useMemo(() => siblings.findIndex((g) => g.id === group?.id), [siblings, group]);

  const goToSibling = useCallback(
    (direction: 1 | -1) => {
      if (siblings.length === 0 || currentIndex === -1) return;
      const nextIndex = (currentIndex + direction + siblings.length) % siblings.length;
      router.replace(`/player/${siblings[nextIndex].tiers[0].channel.id}`);
    },
    [siblings, currentIndex]
  );

  function handleBack() {
    if (channel?.kind === 'radio') {
      router.back();
      return;
    }
    router.back();
  }

  function handleRetry() {
    if (!channel || !controllerRef.current) return;
    setScreenState('loading');
    const streamUrl =
      group && channel.kind !== 'radio'
        ? controllerRef.current.attachChannelGroup(group)
        : channel.streamUrl;
    controllerRef.current.loadChannel(streamUrl).then(() => setScreenState('playing'));
  }

  const isRadio = channel?.kind === 'radio';
  const showVideo = !isRadio;

  return (
    <ScreenSafeArea style={styles.safeArea}>
      <Pressable style={styles.videoWrap} onPress={() => setControlsVisible((v) => !v)}>
        {showVideo ? (
          <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />
        ) : (
          <View style={styles.radioBackdrop}>
            <Ionicons name="radio" size={72} color={colors.cyan} />
            <Text style={styles.radioTitle}>{channel?.name}</Text>
            <Text style={styles.radioHint}>Lecture en cours — vous pouvez naviguer ailleurs.</Text>
          </View>
        )}

        {screenState === 'error' && (
          <View style={styles.overlay}>
            <Ionicons name="alert-circle-outline" size={40} color={colors.danger} />
            <Text style={styles.overlayTitle}>Impossible de lire cette chaîne.</Text>
            <View style={styles.overlayActions}>
              <Pressable style={styles.overlayButton} onPress={handleRetry}>
                <Text style={styles.overlayButtonLabel}>Réessayer</Text>
              </Pressable>
              <Pressable style={[styles.overlayButton, styles.overlayButtonGhost]} onPress={handleBack}>
                <Text style={styles.overlayButtonLabel}>Retour</Text>
              </Pressable>
            </View>
          </View>
        )}

        {(screenState === 'loading' || screenState === 'reconnecting') && !isRadio && (
          <View style={styles.overlay}>
            <Text style={styles.overlayTitle}>{screenState === 'reconnecting' ? 'Reconnexion…' : 'Chargement…'}</Text>
          </View>
        )}

        {controlsVisible && screenState !== 'error' && (
          <View style={styles.controls} pointerEvents="box-none">
            <View style={styles.topBar}>
              <Pressable onPress={handleBack} hitSlop={12}>
                <Ionicons name="chevron-down" size={26} color={colors.textPrimary} />
              </Pressable>
              <View style={styles.channelInfo}>
                <Text style={styles.channelName} numberOfLines={1}>
                  {group?.name ?? channel?.name ?? activeRadio?.name}
                </Text>
                {!isRadio && (
                  <View style={styles.networkRow}>
                    <View
                      style={[styles.dot, { backgroundColor: networkQualityColor[networkState.quality] }]}
                    />
                    <Text style={styles.networkText}>
                      {connectionLevelLabel(networkState)} · {formatPlaybackHeight(playbackHeight)}
                    </Text>
                  </View>
                )}
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

            {!isRadio && (
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
            )}
          </View>
        )}
      </Pressable>
    </ScreenSafeArea>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#000' },
  videoWrap: { flex: 1, backgroundColor: '#000' },
  radioBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  radioTitle: { ...typography.title, color: colors.textPrimary, textAlign: 'center' },
  radioHint: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
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
