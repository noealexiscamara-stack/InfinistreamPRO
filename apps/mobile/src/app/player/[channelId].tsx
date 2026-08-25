import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useVideoPlayer, type VideoPlayerStatus } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import type { Channel, GroupedChannel } from '@infiny-stream/types';
import { colors, networkQualityColor, radius, spacing, typography } from '@/theme/tokens';
import { getChannelById, getChannels, getSeriesEpisodes } from '@/services/channelsRepository';
import { findGroupContaining, groupedFromChannels } from '@/services/channelGroups';
import { recordHistory } from '@/services/favoritesHistoryRepository';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useNetworkState } from '@/store/useNetworkStore';
import { PlayerController } from '@/services/playback/PlayerController';
import { ensureVodContainerExtension, maskStreamCredentials } from '@/services/playback/streamSource';
import { isXtreamSeriesPlaceholder } from '@/services/persistChannels';
import { useRadioPlayback } from '@/services/playback/RadioPlaybackProvider';
import { connectionLevelLabel } from '@/utils/networkDisplay';
import { formatPlaybackHeight, usePlaybackQualityStore } from '@/store/usePlaybackQualityStore';
import {
  extractPlayerError,
  usePlaybackDiagnosticsStore,
} from '@/store/usePlaybackDiagnosticsStore';
import {
  nextPlayerAspectMode,
  playerAspectModeLabel,
} from '@/services/playback/playerAspectRatio';
import { usePlayerAspectStore } from '@/store/usePlayerAspectStore';
import { useImmersivePlayback } from '@/hooks/useImmersivePlayback';
import { usePlaybackKeepAwake } from '@/hooks/usePlaybackKeepAwake';
import { PlayerVideoSurface } from '@/components/player/PlayerVideoSurface';
import { PlayerChannelPicker } from '@/components/player/PlayerChannelPicker';
import { PlayerGestureLayer } from '@/components/player/PlayerGestureLayer';
import { useParentalStore } from '@/store/useParentalStore';
import { forceDeactivatePlaybackKeepAwake } from '@/services/playback/playbackKeepAwake';

type PlayerScreenState = 'loading' | 'playing' | 'reconnecting' | 'error';

const CONTROLS_HIDE_MS = 5000;
const ASPECT_HINT_MS = 1600;

export default function PlayerScreen() {
  const { channelId: rawChannelId } = useLocalSearchParams<{ channelId: string }>();
  const channelId = Array.isArray(rawChannelId) ? rawChannelId[0] : rawChannelId;

  const [channel, setChannel] = useState<Channel | null>(null);
  const [group, setGroup] = useState<GroupedChannel | null>(null);
  const [siblings, setSiblings] = useState<GroupedChannel[]>([]);
  const [episodeSiblings, setEpisodeSiblings] = useState<Channel[]>([]);
  const [screenState, setScreenState] = useState<PlayerScreenState>('loading');
  const [controlsVisible, setControlsVisible] = useState(true);
  const [channelListVisible, setChannelListVisible] = useState(false);
  const [aspectHint, setAspectHint] = useState<string | null>(null);

  const qualityMode = useSettingsStore((s) => s.qualityMode);
  const aspectMode = usePlayerAspectStore((s) => s.aspectMode);
  const setAspectMode = usePlayerAspectStore((s) => s.setAspectMode);
  const networkState = useNetworkState();
  const playbackHeight = usePlaybackQualityStore((s) => s.height);
  const setPlaybackHeight = usePlaybackQualityStore((s) => s.setHeight);
  const clearPlaybackQuality = usePlaybackQualityStore((s) => s.clear);
  const recordFailure = usePlaybackDiagnosticsStore((s) => s.recordFailure);
  const [lastErrorSummary, setLastErrorSummary] = useState<string | null>(null);
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

  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aspectHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const insets = useSafeAreaInsets();
  const isRadio = channel?.kind === 'radio';
  const showVideo = !isRadio;
  const chromeVisible = controlsVisible || channelListVisible;

  /** Video is edge-to-edge; chrome (controls / error actions) stays inside safe margins. */
  const chromeInsets = {
    paddingTop: Math.max(insets.top, spacing.sm) + spacing.sm,
    paddingBottom: Math.max(insets.bottom, spacing.sm) + spacing.sm,
    paddingLeft: Math.max(insets.left, spacing.sm) + spacing.md,
    paddingRight: Math.max(insets.right, spacing.sm) + spacing.md,
  };

  useImmersivePlayback(showVideo && screenState !== 'error', chromeVisible);

  /** Live / VOD / séries only — radios laissent l'écran s'éteindre. */
  usePlaybackKeepAwake(showVideo && screenState === 'playing', player.playing);

  const channelNumber = (group?.sortIndex ?? channel?.sortIndex ?? 0) + 1;
  const channelTitle = group?.name ?? channel?.name ?? activeRadio?.name ?? '';

  const showAspectHint = useCallback((label: string) => {
    setAspectHint(label);
    if (aspectHintTimer.current) clearTimeout(aspectHintTimer.current);
    aspectHintTimer.current = setTimeout(() => setAspectHint(null), ASPECT_HINT_MS);
  }, []);

  const cycleAspectMode = useCallback(() => {
    const next = nextPlayerAspectMode(aspectMode);
    setAspectMode(next);
    showAspectHint(playerAspectModeLabel(next));
    setControlsVisible(true);
  }, [aspectMode, setAspectMode, showAspectHint]);

  const scheduleHideControls = useCallback(() => {
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    if (channelListVisible || screenState !== 'playing' || isRadio) return;
    hideControlsTimer.current = setTimeout(() => {
      setControlsVisible(false);
    }, CONTROLS_HIDE_MS);
  }, [channelListVisible, screenState, isRadio]);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    scheduleHideControls();
  }, [scheduleHideControls]);

  const toggleControls = useCallback(() => {
    setControlsVisible((visible) => {
      const next = !visible;
      if (next) scheduleHideControls();
      else if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
      return next;
    });
  }, [scheduleHideControls]);

  useEffect(() => {
    if (controlsVisible && screenState === 'playing' && !channelListVisible && !isRadio) {
      scheduleHideControls();
    }
    return () => {
      if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    };
  }, [controlsVisible, screenState, channelListVisible, isRadio, scheduleHideControls]);

  useEffect(() => {
    return () => {
      clearPlaybackQuality();
      if (aspectHintTimer.current) clearTimeout(aspectHintTimer.current);
      forceDeactivatePlaybackKeepAwake();
      void controllerRef.current?.releaseSource('screen-unmount');
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
      setEpisodeSiblings([]);
      setControlsVisible(true);
      setChannelListVisible(false);

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

      const parental = useParentalStore.getState();
      const adultAllowed = parental.pinConfigured && parental.unlocked;
      if (ch.isAdult && !adultAllowed) {
        setScreenState('error');
        setLastErrorSummary('Contenu adulte masqué. Déverrouillez le contrôle parental dans Réglages.');
        return;
      }

      if (ch.kind === 'series' && ch.xtreamSeriesId != null && ch.xtreamEpisodeId) {
        const eps = await getSeriesEpisodes(ch.sourceId, ch.xtreamSeriesId);
        if (!cancelled) setEpisodeSiblings(eps);
      }

      let streamUrl = ch.streamUrl;
      if (ch.kind === 'movie' || ch.kind === 'series') {
        streamUrl = ensureVodContainerExtension(streamUrl, ch.containerExtension);
        console.log(
          `[Player] VOD resolve kind=${ch.kind} ext=${ch.containerExtension ?? '(none)'} ` +
            `xtreamStreamId=${ch.xtreamStreamId ?? '-'} url=${maskStreamCredentials(streamUrl)}`
        );
      }
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
        await controller.releaseSource('switch-to-radio');
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
        await controller.loadChannel(streamUrl, ch.kind);
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
      void controller.releaseSource('channel-change', { cancelPending: true });
    };
  }, [channelId, playRadio, stopRadio]);

  useEffect(() => {
    controllerRef.current?.setMode(qualityMode);
  }, [qualityMode]);

  useEffect(() => {
    const statusSub = player.addListener(
      'statusChange',
      (event: { status: VideoPlayerStatus; error?: unknown }) => {
        if (event.status !== 'error') return;

        const controller = controllerRef.current;
        const streamUrl = controller?.getCurrentStreamUrl() ?? channel?.streamUrl ?? '';
        const timeToFailureMs = controller?.getTimeSinceLoadMs() ?? 0;
        const fromEvent = extractPlayerError(event.error);
        const fromPlayer = extractPlayerError((player as { error?: unknown }).error);
        const extracted =
          fromEvent.message !== 'Erreur inconnue (pas de détail exposé)' ? fromEvent : fromPlayer;

        console.error('[Player] status=error', {
          channel: channel?.name,
          streamUrl,
          timeToFailureMs,
          code: extracted.code,
          message: extracted.message,
          raw: extracted.raw,
        });

        if (channel) {
          recordFailure({
            channelId: channel.id,
            channelName: group?.name ?? channel.name,
            streamUrl,
            errorCode: extracted.code,
            errorMessage: extracted.message,
            timeToFailureMs,
            rawErrorJson: extracted.raw.slice(0, 4000),
          });
        }
        setLastErrorSummary(
          [extracted.code, extracted.message].filter(Boolean).join(' — ') || 'Erreur lecteur'
        );
        setControlsVisible(true);
        forceDeactivatePlaybackKeepAwake();

        void controller?.handlePlaybackError('source');
      }
    );
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
  }, [player, setPlaybackHeight, recordFailure, channel, group]);

  const episodeIndex = channel ? episodeSiblings.findIndex((ep) => ep.id === channel.id) : -1;
  const showEpisodeSkip =
    channel?.kind === 'series' && !!channel.xtreamEpisodeId && episodeSiblings.length > 1;

  const goToEpisode = useCallback(
    (direction: 1 | -1) => {
      if (!showEpisodeSkip || episodeIndex < 0) return;
      const nextIndex = episodeIndex + direction;
      if (nextIndex < 0 || nextIndex >= episodeSiblings.length) return;
      router.replace(`/player/${episodeSiblings[nextIndex].id}`);
    },
    [showEpisodeSkip, episodeIndex, episodeSiblings]
  );

  const selectChannelFromList = useCallback((item: GroupedChannel) => {
    setChannelListVisible(false);
    router.replace(`/player/${item.tiers[0].channel.id}`);
  }, []);

  function handleBack() {
    forceDeactivatePlaybackKeepAwake();
    void controllerRef.current?.releaseSource('back');
    router.back();
  }

  function handleRetry() {
    if (!channel || !controllerRef.current) return;
    setScreenState('loading');
    let streamUrl =
      group && channel.kind !== 'radio'
        ? controllerRef.current.attachChannelGroup(group)
        : channel.streamUrl;
    if (channel.kind === 'movie' || channel.kind === 'series') {
      streamUrl = ensureVodContainerExtension(streamUrl, channel.containerExtension);
    }
    controllerRef.current.loadChannel(streamUrl, channel.kind).then(() => setScreenState('playing'));
  }

  return (
    <View style={styles.root}>
      <View style={styles.videoWrap}>
        {showVideo ? (
          <>
            <PlayerVideoSurface player={player} aspectMode={aspectMode} />
            <PlayerGestureLayer
              player={player}
              onToggleControls={toggleControls}
              onCycleAspect={cycleAspectMode}
            />
          </>
        ) : (
          <View style={styles.radioBackdrop}>
            <Ionicons name="radio" size={72} color={colors.cyan} />
            <Text style={styles.radioTitle}>{channel?.name}</Text>
            <Text style={styles.radioHint}>Lecture en cours — vous pouvez naviguer ailleurs.</Text>
          </View>
        )}

        {!!aspectHint && (
          <View style={styles.aspectHint} pointerEvents="none">
            <Text style={styles.aspectHintText}>{aspectHint}</Text>
          </View>
        )}

        {screenState === 'error' && (
          <View style={[styles.overlay, chromeInsets]}>
            <Ionicons name="alert-circle-outline" size={40} color={colors.danger} />
            <Text style={styles.overlayTitle}>Impossible de lire cette chaîne.</Text>
            {!!lastErrorSummary && (
              <Text style={styles.errorDetail} numberOfLines={4}>
                {lastErrorSummary}
              </Text>
            )}
            <View style={styles.overlayActions}>
              <Pressable style={styles.overlayButton} onPress={handleRetry}>
                <Text style={styles.overlayButtonLabel}>Réessayer</Text>
              </Pressable>
              <Pressable
                style={[styles.overlayButton, styles.overlayButtonGhost]}
                onPress={() => router.push('/diagnostics/playback' as Href)}
              >
                <Text style={styles.overlayButtonLabel}>Diagnostic</Text>
              </Pressable>
              <Pressable style={[styles.overlayButton, styles.overlayButtonGhost]} onPress={handleBack}>
                <Text style={styles.overlayButtonLabel}>Retour</Text>
              </Pressable>
            </View>
          </View>
        )}

        {(screenState === 'loading' || screenState === 'reconnecting') && !isRadio && (
          <View style={[styles.overlay, chromeInsets]}>
            <Text style={styles.overlayTitle}>{screenState === 'reconnecting' ? 'Reconnexion…' : 'Chargement…'}</Text>
          </View>
        )}

        {controlsVisible && screenState !== 'error' && (
          <View style={[styles.controls, chromeInsets]} pointerEvents="box-none">
            <View style={styles.topBar}>
              <Pressable onPress={handleBack} hitSlop={12}>
                <Ionicons name="chevron-down" size={26} color={colors.textPrimary} />
              </Pressable>
              <View style={styles.channelInfo}>
                <View style={styles.titleRow}>
                  {!!channelTitle && (
                    <Text style={styles.channelNumber}>{channelNumber}</Text>
                  )}
                  <Text style={styles.channelName} numberOfLines={1}>
                    {channelTitle}
                  </Text>
                </View>
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
                <Pressable
                  onPress={() => {
                    toggleFavorite(channel.id, channel.sourceId);
                    revealControls();
                  }}
                  hitSlop={12}
                >
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
                {showEpisodeSkip ? (
                  <Pressable
                    style={styles.controlButton}
                    onPress={() => {
                      goToEpisode(-1);
                      revealControls();
                    }}
                    hitSlop={12}
                    disabled={episodeIndex <= 0}
                  >
                    <Ionicons
                      name="play-skip-back"
                      size={26}
                      color={episodeIndex <= 0 ? colors.textTertiary : colors.textPrimary}
                    />
                  </Pressable>
                ) : null}

                <Pressable
                  style={styles.playButton}
                  onPress={() => {
                    if (player.playing) player.pause();
                    else player.play();
                    revealControls();
                  }}
                  hitSlop={12}
                >
                  <Ionicons name={player.playing ? 'pause' : 'play'} size={30} color={colors.textPrimary} />
                </Pressable>

                {showEpisodeSkip ? (
                  <Pressable
                    style={styles.controlButton}
                    onPress={() => {
                      goToEpisode(1);
                      revealControls();
                    }}
                    hitSlop={12}
                    disabled={episodeIndex < 0 || episodeIndex >= episodeSiblings.length - 1}
                  >
                    <Ionicons
                      name="play-skip-forward"
                      size={26}
                      color={
                        episodeIndex < 0 || episodeIndex >= episodeSiblings.length - 1
                          ? colors.textTertiary
                          : colors.textPrimary
                      }
                    />
                  </Pressable>
                ) : null}

                <View style={styles.bottomActions}>
                  <Pressable
                    style={styles.iconAction}
                    onPress={() => cycleAspectMode()}
                    hitSlop={12}
                    accessibilityLabel="Cadrage de l'image"
                  >
                    <Ionicons name="scan-outline" size={22} color={colors.textPrimary} />
                    <Text style={styles.iconActionLabel}>{playerAspectModeLabel(aspectMode)}</Text>
                  </Pressable>

                  {siblings.length > 0 && (
                    <Pressable
                      style={styles.iconAction}
                      onPress={() => {
                        setChannelListVisible(true);
                        revealControls();
                      }}
                      hitSlop={12}
                      accessibilityLabel="Liste des chaînes"
                    >
                      <Ionicons name="list" size={22} color={colors.textPrimary} />
                      <Text style={styles.iconActionLabel}>Liste</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            )}
          </View>
        )}
      </View>

      <PlayerChannelPicker
        visible={channelListVisible}
        channels={siblings}
        activeChannelId={channel?.id}
        onClose={() => {
          setChannelListVisible(false);
          revealControls();
        }}
        onSelect={selectChannelFromList}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  videoWrap: { flex: 1, backgroundColor: '#000' },
  radioBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  radioTitle: { ...typography.title, color: colors.textPrimary, textAlign: 'center' },
  radioHint: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  aspectHint: {
    position: 'absolute',
    alignSelf: 'center',
    top: '45%',
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  aspectHintText: { ...typography.headline, color: colors.textPrimary },
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
    zIndex: 5,
  },
  overlayTitle: { ...typography.headline, color: colors.textPrimary, textAlign: 'center', paddingHorizontal: spacing.xl },
  errorDetail: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
    maxWidth: 480,
  },
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
    backgroundColor: 'rgba(0,0,0,0.28)',
    zIndex: 4,
  },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  channelInfo: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  channelNumber: {
    ...typography.headline,
    color: colors.brand,
    fontVariant: ['tabular-nums'],
    minWidth: 28,
  },
  channelName: { ...typography.headline, color: colors.textPrimary, flex: 1 },
  networkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  networkText: { ...typography.caption, color: colors.textSecondary },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  controlButton: { padding: spacing.sm },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomActions: {
    position: 'absolute',
    right: spacing.lg,
    bottom: 0,
    flexDirection: 'row',
    gap: spacing.md,
  },
  iconAction: {
    alignItems: 'center',
    gap: 2,
    minWidth: 52,
  },
  iconActionLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 10,
  },
});
