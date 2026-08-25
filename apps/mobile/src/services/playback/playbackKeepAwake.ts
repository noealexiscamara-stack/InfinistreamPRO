import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

/** Tag isolé — jamais de verrou global sans ce tag. */
export const PLAYBACK_KEEP_AWAKE_TAG = 'infiny-playback';

let active = false;

/** Pose le verrou d'écran pendant la lecture vidéo (live / VOD / séries). */
export async function activatePlaybackKeepAwake(): Promise<void> {
  if (active) return;
  await activateKeepAwakeAsync(PLAYBACK_KEEP_AWAKE_TAG);
  active = true;
}

/** Retire le verrou (pause, arrêt, sortie lecteur, erreur). */
export function deactivatePlaybackKeepAwake(): void {
  if (!active) return;
  deactivateKeepAwake(PLAYBACK_KEEP_AWAKE_TAG);
  active = false;
}

/** Idempotent — safe après crash / unmount même si le module natif a disparu. */
export function forceDeactivatePlaybackKeepAwake(): void {
  try {
    deactivateKeepAwake(PLAYBACK_KEEP_AWAKE_TAG);
  } catch {
    // Native module may be gone after a hard crash.
  }
  active = false;
}

export function isPlaybackKeepAwakeActive(): boolean {
  return active;
}
