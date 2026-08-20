import * as Network from 'expo-network';
import type { EventSubscription } from 'expo-modules-core';
import {
  ThroughputEstimator,
  assessThroughputSample,
  classifyNetworkQuality,
  logThroughputSample,
} from '@infiny-stream/shared';
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
 * App-wide network awareness. Throughput samples are consultative for the
 * quality label only — they never decide "offline". Offline comes solely
 * from OS connectivity (no link / not reachable).
 */
class NetworkMonitorImpl {
  private readonly estimator = new ThroughputEstimator();
  private connectionType: ConnectionType = 'unknown';
  /** null = OS did not report reachability yet. */
  private isInternetReachable: boolean | null = null;
  private hasValidSamples = false;
  private listeners = new Set<Listener>();
  private subscription: EventSubscription | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  async start(): Promise<void> {
    if (this.subscription) return;

    try {
      const initial = await Network.getNetworkStateAsync();
      this.connectionType = mapConnectionType(initial.type);
      this.isInternetReachable = initial.isInternetReachable ?? null;
    } catch {
      this.connectionType = 'unknown';
      this.isInternetReachable = null;
    }

    this.subscription = Network.addNetworkStateListener((state) => {
      this.connectionType = mapConnectionType(state.type);
      this.isInternetReachable = state.isInternetReachable ?? null;
      this.emit();
    });

    this.pollTimer = setInterval(() => this.emit(), 5000);
  }

  stop(): void {
    this.subscription?.remove();
    this.subscription = null;
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  /**
   * Accept a timed download as a bandwidth sample only when large enough.
   * Returns whether the sample was retained.
   */
  reportTimedDownload(bytes: number, elapsedMs: number, source = 'download'): boolean {
    const assessment = assessThroughputSample(bytes, elapsedMs);
    logThroughputSample(assessment, source);
    if (!assessment.accepted) return false;

    this.hasValidSamples = true;
    this.estimator.addSample({
      timestampMs: Date.now(),
      throughputKbps: assessment.throughputKbps,
      connectionType: this.connectionType,
      fromStall: false,
    });
    this.emit();
    return true;
  }

  reportSample(sample: Omit<NetworkSample, 'connectionType'>): void {
    // Legacy path — still gate on absurdly low throughput from tiny transfers
    // when callers pass a precomputed kbps without byte size. Prefer reportTimedDownload.
    if (sample.throughputKbps > 0 && sample.throughputKbps < 50 && !sample.fromStall) {
      console.log(
        `[Throughput] REJECTED source=precomputed_kbps kbps=${sample.throughputKbps} reason=rejected_suspiciously_low`
      );
      return;
    }
    this.hasValidSamples = true;
    this.estimator.addSample({ ...sample, connectionType: this.connectionType });
    this.emit();
  }

  reportStall(observedKbps: number, atMs: number): void {
    this.reportSample({ timestampMs: atMs, throughputKbps: observedKbps, fromStall: true });
  }

  private isSystemOffline(): boolean {
    if (this.connectionType === 'none') return true;
    if (this.isInternetReachable === false) return true;
    return false;
  }

  getState(): NetworkState {
    const now = Date.now();

    if (this.isSystemOffline()) {
      return {
        quality: 'offline',
        connectionType: this.connectionType,
        estimatedThroughputKbps: 0,
        isStable: false,
        lastUpdated: now,
      };
    }

    if (!this.hasValidSamples || this.estimator.estimatedKbps <= 0) {
      return {
        quality: 'unknown',
        connectionType: this.connectionType,
        estimatedThroughputKbps: 0,
        isStable: false,
        lastUpdated: now,
      };
    }

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
