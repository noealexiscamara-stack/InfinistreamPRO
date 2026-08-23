import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { NavigationBar, setVisibilityAsync } from 'expo-navigation-bar';
import { setStatusBarHidden } from 'expo-status-bar';

/**
 * Best-effort system-bar hide for playback.
 *
 * WARNING — not verified on device from this environment. On Android 15+
 * edge-to-edge is enforced and NavigationBar.setHidden / setVisibilityAsync
 * may be no-ops depending on OEM / Expo edge-to-edge config. Do not treat a
 * successful call as proof the bar is gone — confirm visually on hardware.
 * Player chrome always uses safe-area insets so controls stay usable even
 * when the bar remains visible.
 */
function applyAndroidImmersive(hidden: boolean): void {
  if (Platform.OS !== 'android') return;
  try {
    NavigationBar.setHidden(hidden);
  } catch {
    // ignore — API may be unavailable on some builds
  }
  void setVisibilityAsync(hidden ? 'hidden' : 'visible').catch(() => {
    // deprecated path; may fail silently on Android 15+
  });
}

/**
 * Hides system bars while watching; restores them when controls are shown or on leave.
 * Status bar hide (expo-status-bar) is more reliable than the nav bar on recent Android.
 */
export function useImmersivePlayback(active: boolean, controlsVisible: boolean): void {
  const immersive = active && !controlsVisible;

  useEffect(() => {
    if (!active) {
      setStatusBarHidden(false, 'fade');
      applyAndroidImmersive(false);
      return;
    }

    setStatusBarHidden(immersive, 'fade');
    applyAndroidImmersive(immersive);

    return () => {
      setStatusBarHidden(false, 'fade');
      applyAndroidImmersive(false);
    };
  }, [active, immersive]);

  useEffect(() => {
    if (!active) return;

    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      setStatusBarHidden(immersive, 'fade');
      applyAndroidImmersive(immersive);
    });

    return () => subscription.remove();
  }, [active, immersive]);
}
