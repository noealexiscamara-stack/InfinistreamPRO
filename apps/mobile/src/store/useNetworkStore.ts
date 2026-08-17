import { useEffect } from 'react';
import { create } from 'zustand';
import type { NetworkState } from '@infiny-stream/types';
import { NetworkMonitor } from '@/services/network/NetworkMonitor';

interface NetworkStoreState {
  state: NetworkState;
  setState: (state: NetworkState) => void;
}

const useNetworkStoreInternal = create<NetworkStoreState>((set) => ({
  state: {
    quality: 'medium',
    connectionType: 'unknown',
    estimatedThroughputKbps: 0,
    isStable: false,
    lastUpdated: Date.now(),
  },
  setState: (state) => set({ state }),
}));

/**
 * Mounts the singleton NetworkMonitor and mirrors its state into a
 * zustand store so any screen (Home header, Settings, Player) can read
 * "Connexion : Bonne / Qualité : HD / Mode : AUTO" reactively. Call once
 * near the app root (see app/_layout.tsx); reading the hook elsewhere is
 * always safe even before this has mounted (sensible defaults above).
 */
export function useNetworkMonitorBootstrap(): void {
  const setState = useNetworkStoreInternal((s) => s.setState);

  useEffect(() => {
    NetworkMonitor.start();
    const unsubscribe = NetworkMonitor.subscribe(setState);
    setState(NetworkMonitor.getState());
    return () => {
      unsubscribe();
      NetworkMonitor.stop();
    };
  }, [setState]);
}

export function useNetworkState(): NetworkState {
  return useNetworkStoreInternal((s) => s.state);
}
