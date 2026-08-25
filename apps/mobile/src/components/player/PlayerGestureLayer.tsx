import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import * as Brightness from 'expo-brightness';
import type { VideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '@/theme/tokens';

type ScrubKind = 'brightness' | 'volume' | null;

interface PlayerGestureLayerProps {
  player: VideoPlayer;
  onToggleControls: () => void;
  onCycleAspect: () => void;
}

/**
 * Netflix-style player gestures:
 * - tap anywhere → show/hide controls
 * - double-tap → aspect cycle (Exclusive with single tap)
 * - vertical pan left half → brightness
 * - vertical pan right half → volume
 */
export function PlayerGestureLayer({ player, onToggleControls, onCycleAspect }: PlayerGestureLayerProps) {
  const { width, height } = useWindowDimensions();
  const [scrub, setScrub] = useState<ScrubKind>(null);
  const [scrubValue, setScrubValue] = useState(0);
  const startBrightness = useRef(0.5);
  const startVolume = useRef(1);
  const scrubKindRef = useRef<ScrubKind>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const current = await Brightness.getBrightnessAsync();
        if (!cancelled) startBrightness.current = current;
      } catch {
        /* brightness API unavailable on some hosts */
      }
    })();
    return () => {
      cancelled = true;
      void Brightness.restoreSystemBrightnessAsync().catch(() => undefined);
    };
  }, []);

  const showScrub = useCallback((kind: ScrubKind, value: number) => {
    setScrub(kind);
    setScrubValue(value);
  }, []);

  const hideScrub = useCallback(() => {
    setScrub(null);
    scrubKindRef.current = null;
  }, []);

  const applyBrightness = useCallback(async (value: number) => {
    const clamped = Math.min(1, Math.max(0.01, value));
    showScrub('brightness', clamped);
    try {
      await Brightness.setBrightnessAsync(clamped);
    } catch {
      /* ignore */
    }
  }, [showScrub]);

  const applyVolume = useCallback(
    (value: number) => {
      const clamped = Math.min(1, Math.max(0, value));
      showScrub('volume', clamped);
      player.volume = clamped;
    },
    [player, showScrub]
  );

  const beginPan = useCallback(
    (x: number) => {
      const kind: ScrubKind = x < width / 2 ? 'brightness' : 'volume';
      scrubKindRef.current = kind;
      if (kind === 'volume') {
        startVolume.current = player.volume;
      } else {
        void Brightness.getBrightnessAsync()
          .then((v) => {
            startBrightness.current = v;
          })
          .catch(() => undefined);
      }
    },
    [player, width]
  );

  const onPanUpdate = useCallback(
    (translationY: number) => {
      const kind = scrubKindRef.current;
      if (!kind) return;
      // Up = increase, down = decrease
      const delta = -translationY / (height * 0.45);
      if (kind === 'brightness') {
        void applyBrightness(startBrightness.current + delta);
      } else {
        applyVolume(startVolume.current + delta);
      }
    },
    [applyBrightness, applyVolume, height]
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-14, 14])
        .failOffsetX([-28, 28])
        .onBegin((e) => {
          runOnJS(beginPan)(e.x);
        })
        .onUpdate((e) => {
          runOnJS(onPanUpdate)(e.translationY);
        })
        .onEnd(() => {
          runOnJS(hideScrub)();
        })
        .onFinalize(() => {
          runOnJS(hideScrub)();
        }),
    [beginPan, hideScrub, onPanUpdate]
  );

  const singleTap = useMemo(
    () =>
      Gesture.Tap()
        .numberOfTaps(1)
        .maxDuration(250)
        .onEnd(() => {
          runOnJS(onToggleControls)();
        }),
    [onToggleControls]
  );

  const doubleTap = useMemo(
    () =>
      Gesture.Tap()
        .numberOfTaps(2)
        .onEnd(() => {
          runOnJS(onCycleAspect)();
        }),
    [onCycleAspect]
  );

  // Pan wins over taps when vertical drag is intentional; double-tap wins over single.
  const composed = useMemo(
    () => Gesture.Exclusive(panGesture, Gesture.Exclusive(doubleTap, singleTap)),
    [panGesture, doubleTap, singleTap]
  );

  const percent = Math.round(scrubValue * 100);

  return (
    <GestureDetector gesture={composed}>
      <View style={styles.layer} collapsable={false}>
        {scrub ? (
          <View
            style={[styles.indicator, scrub === 'brightness' ? styles.indicatorLeft : styles.indicatorRight]}
            pointerEvents="none"
          >
            <Ionicons
              name={scrub === 'brightness' ? 'sunny' : 'volume-high'}
              size={22}
              color={colors.textPrimary}
            />
            <Text style={styles.indicatorText}>{percent}%</Text>
          </View>
        ) : null}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    zIndex: 2,
  },
  indicator: {
    position: 'absolute',
    top: '42%',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(0,0,0,0.72)',
    minWidth: 72,
  },
  indicatorLeft: { left: '12%' },
  indicatorRight: { right: '12%' },
  indicatorText: { ...typography.headline, color: colors.textPrimary },
});
