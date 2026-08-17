import * as Network from 'expo-network';
import type { EventSubscription } from 'expo-modules-core';
import { ThroughputEstimator, classifyNetworkQuality } from '@infiny-stream/shared';
import type { ConnectionType, NetworkSample, NetworkState } from '@infiny-stream/types';

type Listener = (state: NetworkState) => void;

function mapConnectionType(type: Network.NetworkStateType | undefined): ConnectionType {
  switch (type) {
    case Network.NetworkStateType.WIFI:
      return 'wifi';
    case Network.NetworkStateType.CELLULAR:
      return 'cellular';
    case Network.NetworkStateType.ETHERNET:
      return 'ethernet';
    case Network.NetworkStateType.NONE:
      return 'none';
    default:
      return 'unknown';
  }
}

/**
 * App-wide network awareness, independent of whether a channel is
 * currently playing. Two layers of information, in priority order:
 *
 *  1. Real observed throughput (segment/manifest download timings, and
 *     stall events) reported by the player layer via reportSample /
 *     reportStall — the ground truth, per product rule #22 ("un WiFi peut
 *     être lent, une 4G peut être excellente").
 *  2. A provisional heuristic from the OS-reported connection type
 *     (WiFi/cellular/none), used only before any real sample exists —
 *     e.g. right after launch, on the Home screen, before the user has
 *     opened a channel. This is clearly a guess and is overridden the
 *     moment real measurements start arriving.
 *
 * This is a singleton: the whole app shares one throughput estimate,
 * because "how good is my connection right now" is a single fact, not
 * something each screen should measure independently.
 */
class NetworkMonitorImpl {
  private readonly estimator = new ThroughputEstimator();
  private connectionType: ConnectionType = 'unknown';
  private hasRealSamples = false;
  private listeners = new Set<Listener>();
  private subscription: EventSubscription | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  async start(): Promise<void> {
    if (this.subscription) return;

    try {
      const initial = await Network.getNetworkStateAsync();
      this.connectionType = mapConnectionType(initial.type);
    } catch {
      this.connectionType = 'unknown';
    }

    this.subscription = Network.addNetworkStateListener((state) => {
      this.connectionType = mapConnectionType(state.type);
      this.emit();
    });

    // Even with no active playback, refresh the provisional state
    // periodically so the Home screen indicator doesn't look frozen.
    this.pollTimer = setInterval(() => this.emit(), 5000);
  }

  stop(): void {
    this.subscription?.remove();
    this.subscription = null;
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  reportSample(sample: Omit<NetworkSample, 'connectionType'>): void {
    this.hasRealSamples = true;
    this.estimator.addSample({ ...sample, connectionType: this.connectionType });
    this.emit();
  }

  reportStall(observedKbps: number, atMs: number): void {
    this.reportSample({ timestampMs: atMs, throughputKbps: observedKbps, fromStall: true });
  }

  getState(): NetworkState {
    const now = Date.now();

    if (this.connectionType === 'none') {
      return { quality: 'offline', connectionType: 'none', estimatedThroughputKbps: 0, isStable: false, lastUpdated: now };
    }

    if (this.hasRealSamples) {
      const throughput = this.estimator.estimatedKbps;
      const stable = this.estimator.isStable;
      return {
        quality: classifyNetworkQuality(throughput, stable),
        connectionType: this.connectionType,
        estimatedThroughputKbps: throughput,
        isStable: stable,
        lastUpdated: now,
      };
    }

    // Provisional, connection-type-only guess (no real measurement yet).
    const provisionalQuality = this.connectionType === 'wifi' || this.connectionType === 'ethernet' ? 'good' : 'medium';
    return {
      quality: provisionalQuality,
      connectionType: this.connectionType,
      estimatedThroughputKbps: 0,
      isStable: false,
      lastUpdated: now,
    };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    const state = this.getState();
    this.listeners.forEach((l) => l(state));
  }
}

export const NetworkMonitor = new NetworkMonitorImpl();
