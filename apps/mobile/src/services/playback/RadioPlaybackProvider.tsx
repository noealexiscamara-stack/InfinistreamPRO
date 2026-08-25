import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { buildStreamVideoSource } from '@/services/playback/streamSource';
import { useStreamSessionStats } from '@/store/useStreamSessionStats';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Channel } from '@infiny-stream/types';
import { colors, radius, spacing, typography } from '@/theme/tokens';

interface RadioPlaybackContextValue {
  playRadio: (channel: Channel) => void;
  stopRadio: () => void;
  activeChannel: Channel | null;
}

const RadioPlaybackContext = createContext<RadioPlaybackContextValue | null>(null);

export function RadioPlaybackProvider({ children }: { children: ReactNode }) {
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const player = useVideoPlayer(null, (p) => {
    p.loop = false;
    p.staysActiveInBackground = true;
  });

  const playRadio = useCallback(
    (channel: Channel) => {
      setActiveChannel(channel);
      console.log(`[Player/Radio] source OPEN url=${channel.streamUrl.slice(0, 120)}`);
      useStreamSessionStats.getState().recordOpen(channel.streamUrl);
      player.replace(buildStreamVideoSource(channel.streamUrl));
      player.play();
    },
    [player]
  );

  const stopRadio = useCallback(() => {
    if (activeChannel) {
      console.log(`[Player/Radio] source RELEASE url=${activeChannel.streamUrl.slice(0, 120)}`);
      useStreamSessionStats.getState().recordRelease('radio-stop', activeChannel.streamUrl);
    }
    player.pause();
    player.replace(null);
    setActiveChannel(null);
  }, [player, activeChannel]);

  const value = useMemo(() => ({ playRadio, stopRadio, activeChannel }), [playRadio, stopRadio, activeChannel]);

  return (
    <RadioPlaybackContext.Provider value={value}>
      {activeChannel && (
        <View style={styles.hiddenPlayer} pointerEvents="none">
          <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />
        </View>
      )}
      {children}
      {activeChannel && (
        <Pressable style={styles.miniBar} onPress={() => router.push(`/player/${activeChannel.id}`)}>
          <Ionicons name="radio-outline" size={20} color={colors.cyan} />
          <Text style={styles.miniTitle} numberOfLines={1}>
            {activeChannel.name}
          </Text>
          <Pressable
            hitSlop={12}
            onPress={(e) => {
              e.stopPropagation?.();
              stopRadio();
            }}
          >
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </Pressable>
        </Pressable>
      )}
    </RadioPlaybackContext.Provider>
  );
}

export function useRadioPlayback(): RadioPlaybackContextValue {
  const ctx = useContext(RadioPlaybackContext);
  if (!ctx) throw new Error('useRadioPlayback must be used within RadioPlaybackProvider');
  return ctx;
}

const styles = StyleSheet.create({
  hiddenPlayer: { position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' },
  miniBar: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 100,
  },
  miniTitle: { ...typography.bodyStrong, color: colors.textPrimary, flex: 1 },
});
