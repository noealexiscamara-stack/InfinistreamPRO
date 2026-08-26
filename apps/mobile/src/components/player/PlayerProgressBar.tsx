import { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder, StyleSheet, Text, View } from 'react-native';
import type { VideoPlayer } from 'expo-video';
import { formatPlaybackClock } from '@/services/playback/playerProgress';
import { colors, radius, spacing, typography } from '@/theme/tokens';

function formatClock(seconds: number): string {
  return formatPlaybackClock(seconds);
}

interface PlayerProgressBarProps {
  player: VideoPlayer;
  /** Called when the user interacts so chrome stays visible. */
  onInteraction?: () => void;
}

/**
 * VOD / series scrubber only — never mount for live (no seekable timeline).
 */
export function PlayerProgressBar({ player, onInteraction }: PlayerProgressBarProps) {
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dragRatio, setDragRatio] = useState(0);
  const trackWidth = useRef(0);
  const durationRef = useRef(0);

  useEffect(() => {
    player.timeUpdateEventInterval = 0.25;
    const sub = player.addListener('timeUpdate', (event: { currentTime: number }) => {
      if (dragging) return;
      setCurrent(event.currentTime);
      const d = player.duration;
      if (Number.isFinite(d) && d > 0) {
        durationRef.current = d;
        setDuration(d);
      }
    });
    return () => {
      sub.remove();
      player.timeUpdateEventInterval = 0;
    };
  }, [player, dragging]);

  const onTrackLayout = useCallback((e: LayoutChangeEvent) => {
    trackWidth.current = e.nativeEvent.layout.width;
  }, []);

  const ratioFromX = useCallback((x: number) => {
    const w = trackWidth.current;
    if (w <= 0) return 0;
    return Math.max(0, Math.min(1, x / w));
  }, []);

  const seekToRatio = useCallback(
    (ratio: number) => {
      const d = durationRef.current || player.duration;
      if (!Number.isFinite(d) || d <= 0) return;
      player.currentTime = ratio * d;
      setCurrent(ratio * d);
    },
    [player]
  );

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        setDragging(true);
        onInteraction?.();
        const r = ratioFromX(evt.nativeEvent.locationX);
        setDragRatio(r);
      },
      onPanResponderMove: (evt) => {
        const r = ratioFromX(evt.nativeEvent.locationX);
        setDragRatio(r);
        onInteraction?.();
      },
      onPanResponderRelease: (evt) => {
        const r = ratioFromX(evt.nativeEvent.locationX);
        seekToRatio(r);
        setDragging(false);
        onInteraction?.();
      },
      onPanResponderTerminate: () => {
        setDragging(false);
      },
    })
  ).current;

  const progress =
    duration > 0 ? (dragging ? dragRatio : Math.max(0, Math.min(1, current / duration))) : 0;
  const displayCurrent = dragging && duration > 0 ? dragRatio * duration : current;

  return (
    <View style={styles.row}>
      <Text style={styles.time}>{formatClock(displayCurrent)}</Text>
      <View style={styles.hit} onLayout={onTrackLayout} {...pan.panHandlers}>
        <View style={styles.rail}>
          <View style={[styles.fill, { width: `${progress * 100}%` }]} />
        </View>
        <View style={[styles.thumb, { left: `${progress * 100}%` }]} />
      </View>
      <Text style={styles.time}>{duration > 0 ? formatClock(duration) : '—:——'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    width: '100%',
  },
  time: {
    ...typography.caption,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
    minWidth: 44,
    textAlign: 'center',
  },
  hit: {
    flex: 1,
    height: 28,
    justifyContent: 'center',
  },
  rail: {
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.28)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.brand,
  },
  thumb: {
    position: 'absolute',
    marginStart: -7,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#fff',
    top: 7,
  },
});
