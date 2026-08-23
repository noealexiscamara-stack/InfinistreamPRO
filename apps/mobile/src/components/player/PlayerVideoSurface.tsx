import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { VideoView, type VideoPlayer } from 'expo-video';
import type { PlayerAspectMode } from '@/services/playback/playerAspectRatio';
import { contentFitForAspectMode, forcedAspectRatio } from '@/services/playback/playerAspectRatio';

interface PlayerVideoSurfaceProps {
  player: VideoPlayer;
  aspectMode: PlayerAspectMode;
}

export function PlayerVideoSurface({ player, aspectMode }: PlayerVideoSurfaceProps) {
  const { width, height } = useWindowDimensions();
  const contentFit = contentFitForAspectMode(aspectMode);
  const ratio = forcedAspectRatio(aspectMode);

  if (ratio == null) {
    return (
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit={contentFit}
        nativeControls={false}
      />
    );
  }

  const boxWidth = Math.min(width, height * ratio);
  const boxHeight = boxWidth / ratio;

  return (
    <View style={styles.ratioStage}>
      <View style={[styles.ratioBox, { width: boxWidth, height: boxHeight }]}>
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          nativeControls={false}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ratioStage: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  ratioBox: {
    backgroundColor: '#000',
    overflow: 'hidden',
  },
});
