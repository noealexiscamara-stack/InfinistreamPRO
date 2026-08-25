import { useEffect } from 'react';
import {
  activatePlaybackKeepAwake,
  deactivatePlaybackKeepAwake,
  forceDeactivatePlaybackKeepAwake,
} from '@/services/playback/playbackKeepAwake';

/**
 * Verrou d'écran pendant la lecture vidéo effective uniquement.
 * Pas de verrou pour les radios (passer enabled=false).
 *
 * Chemins de retrait couverts :
 * - pause (isPlaying=false)
 * - erreur / chargement (enabled=false)
 * - changement de chaîne (cleanup effect)
 * - sortie écran lecteur (cleanup effect)
 * - crash / unmount (forceDeactivate dans cleanup)
 */
export function usePlaybackKeepAwake(enabled: boolean, isPlaying: boolean): void {
  const shouldKeepAwake = enabled && isPlaying;

  useEffect(() => {
    if (shouldKeepAwake) {
      void activatePlaybackKeepAwake();
    } else {
      deactivatePlaybackKeepAwake();
    }
    return () => {
      forceDeactivatePlaybackKeepAwake();
    };
  }, [shouldKeepAwake]);
}
