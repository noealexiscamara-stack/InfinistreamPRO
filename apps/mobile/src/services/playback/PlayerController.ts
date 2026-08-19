import type { VideoPlayer, VideoSource } from 'expo-video';
import {
  AdaptiveStreamingManager,
  ChannelTierSwitcher,
  parseHlsMasterPlaylist,
  QUALITY_MODE_PROFILES,
  type QualityDecision,
} from '@infiny-stream/shared';
import type { GroupedChannel, NetworkState, QualityMode, StreamVariant } from '@infiny-stream/types';
import { QUALITY_REEVALUATION_INTERVAL_MS } from '@infiny-stream/config';
import { NetworkMonitor } from '@/services/network/NetworkMonitor';

/**
 * IMPORTANT — integration surface, not covered by the sandbox test suite:
 * this class drives a real expo-video `VideoPlayer` instance, which only
 * exists at runtime on a device/emulator with the native module loaded.
 * The logic it orchestrates (variant ladder parsing, quality decisions,
 * reconnection backoff) is unit-testable and *is* tested — see
 * packages/shared/src/{hls,playback}/__tests__. This file is the thin,
 * necessarily-untested glue that wires that logic to the actual player.
 * Validate it on a real Android build (see docs/LIMITATIONS.md).
 *
 * Architecture note: Media3/ExoPlayer (which expo-video wraps on Android)
 * already runs its own internal adaptive bitrate switching for a true HLS
 * master playlist — that engine is generally excellent and we do not
 * fight it. What it does *not* expose at the JS layer (as of expo-video's
 * current API) is a way to (a) cap the max rendition for Économie/
 * Équilibré modes, or (b) read per-segment bandwidth for our own network
 * indicator. This controller closes both gaps by parsing the master
 * playlist ourselves to get the variant ladder, then pointing the player
 * at a *specific* rendition URL when a cap or a deliberate quality-mode
 * choice applies (a standard technique — it simply disables ExoPlayer's
 * own switching for that stream by not giving it the master playlist).
 * When AUTO mode is active, we still hand ExoPlayer the master playlist
 * on the "quality" tier we've selected, but bandwidth-driven step changes
 * go through AdaptiveStreamingManager instead of duplicating an ABR engine.
 */

export type PlayerErrorReason = 'network' | 'source' | 'unknown';

export interface PlayerControllerCallbacks {
  onQualityChange?: (decision: QualityDecision) => void;
  onNetworkStateChange?: (state: NetworkState) => void;
  /** Called for a *user-facing* error (never a raw native exception message — see product rule #30). */
  onFatalError?: (reason: PlayerErrorReason) => void;
  onReconnecting?: (attempt: number, maxAttempts: number) => void;
  onReconnected?: () => void;
}

const RECONNECT_BACKOFF_MS = [0, 1000, 2000, 5000, 10000];
const TIER_REEVALUATION_INTERVAL_MS = 5000;

async function fetchText(url: string, timeoutMs = 8000): Promise<{ text: string; elapsedMs: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();
  try {
    const response = await fetch(url, { signal: controller.signal });
    const text = await response.text();
    return { text, elapsedMs: Date.now() - start };
  } finally {
    clearTimeout(timeout);
  }
}

export class PlayerController {
  private readonly adm = new AdaptiveStreamingManager();
  private readonly player: VideoPlayer;
  private callbacks: PlayerControllerCallbacks = {};
  private reevaluationTimer: ReturnType<typeof setInterval> | null = null;
  private tierTimer: ReturnType<typeof setInterval> | null = null;
  private tierSwitcher: ChannelTierSwitcher | null = null;
  private reconnectAttempt = 0;
  private isReconnecting = false;
  private currentStreamUrl = '';
  private lastKnownSafeUrl = '';
  private hasActiveSource = false;
  private qualityMode: QualityMode = 'auto';
  private disposed = false;

  constructor(player: VideoPlayer) {
    this.player = player;
  }

  setCallbacks(callbacks: PlayerControllerCallbacks): void {
    this.callbacks = callbacks;
  }

  getMode(): QualityMode {
    return this.qualityMode;
  }

  /** Persists the mode immediately; re-evaluation waits until a source is loaded. */
  setMode(mode: QualityMode): void {
    this.qualityMode = mode;
    this.adm.setMode(mode);
    this.tierSwitcher?.setMaxHeightLabel(QUALITY_MODE_PROFILES[mode].maxHeightLabel);
    if (!this.hasActiveSource) return;
    this.reevaluate(true);
    this.reevaluateTier();
  }

  attachChannelGroup(group: GroupedChannel): string {
    this.tierSwitcher = new ChannelTierSwitcher(group, {
      maxHeightLabel: QUALITY_MODE_PROFILES[this.qualityMode].maxHeightLabel,
    });
    return this.tierSwitcher.currentTier().channel.streamUrl;
  }

  /**
   * Loads a channel. `directUrl` is the URL from the source (M3U entry,
   * Xtream stream). We try to parse it as an HLS master playlist to learn
   * the real quality ladder; if it isn't one (single-rendition stream, or
   * a non-HLS direct link), we fall back to a single-variant pass-through
   * — never fabricating quality levels the source doesn't offer.
   */
  async loadChannel(directUrl: string): Promise<void> {
    if (this.disposed) return;
    this.reconnectAttempt = 0;
    this.hasActiveSource = false;
    this.stopReevaluationLoop();
    this.stopTierLoop();
    await this.applyStreamUrl(directUrl);
    if (this.disposed || !this.hasActiveSource) return;
    this.startReevaluationLoop();
    this.startTierLoop();
  }

  private async applyStreamUrl(directUrl: string): Promise<void> {

    let variants: StreamVariant[] = [];
    try {
      if (/\.m3u8(\?|$)/i.test(directUrl)) {
        const { text, elapsedMs } = await fetchText(directUrl);
        this.reportThroughputSample(text.length, elapsedMs);
        variants = parseHlsMasterPlaylist(text, directUrl);
      }
    } catch {
      // Manifest probing is best-effort only; fall through to a direct,
      // single-variant load below.
    }

    if (variants.length > 0) {
      this.adm.setVariants(variants);
    } else {
      this.adm.setVariants([{ id: 'source', heightLabel: 0, bitrateKbps: 0, url: directUrl }]);
    }

    const decision = this.adm.decide(Date.now());
    if (!decision) {
      this.hasActiveSource = false;
      this.stopReevaluationLoop();
      this.stopTierLoop();
      return;
    }

    this.hasActiveSource = true;
    await this.setSource(decision.variant.url);
  }

  private async setSource(url: string): Promise<void> {
    if (this.disposed) return;
    this.currentStreamUrl = url;
    this.lastKnownSafeUrl = url;
    const source: VideoSource = { uri: url };
    this.player.replace(source);
    if (!this.disposed) this.player.play();
  }

  private startTierLoop(): void {
    this.stopTierLoop();
    this.tierTimer = setInterval(() => this.reevaluateTier(), TIER_REEVALUATION_INTERVAL_MS);
  }

  private stopTierLoop(): void {
    if (this.tierTimer) clearInterval(this.tierTimer);
    this.tierTimer = null;
  }

  private reevaluateTier(): void {
    if (this.disposed || !this.tierSwitcher) return;
    const decision = this.tierSwitcher.decide(Date.now());
    if (decision.changed && decision.tier.channel.streamUrl !== this.currentStreamUrl) {
      void this.applyStreamUrl(decision.tier.channel.streamUrl);
    }
  }

  private startReevaluationLoop(): void {
    this.stopReevaluationLoop();
    this.reevaluationTimer = setInterval(() => this.reevaluate(false), QUALITY_REEVALUATION_INTERVAL_MS);
  }

  private stopReevaluationLoop(): void {
    if (this.reevaluationTimer) clearInterval(this.reevaluationTimer);
    this.reevaluationTimer = null;
  }

  private reevaluate(force: boolean): void {
    if (this.disposed || !this.hasActiveSource) return;
    const decision = this.adm.decide(Date.now(), force);
    if (!decision) {
      this.hasActiveSource = false;
      this.stopReevaluationLoop();
      return;
    }
    this.callbacks.onNetworkStateChange?.(this.adm.getNetworkState(Date.now()));
    if (decision.changed && decision.variant.url !== this.currentStreamUrl) {
      this.callbacks.onQualityChange?.(decision);
      void this.setSource(decision.variant.url);
    }
  }

  /** Feed a throughput sample from any timed download (manifest fetch, etc.) into both the per-player and the app-wide estimators. */
  reportThroughputSample(bytes: number, elapsedMs: number): void {
    if (elapsedMs <= 0) return;
    const kbps = Math.round((bytes * 8) / elapsedMs);
    const sample = { timestampMs: Date.now(), throughputKbps: kbps, fromStall: false };
    this.adm.reportSample({ ...sample, connectionType: 'unknown' });
    this.tierSwitcher?.reportThroughput(kbps);
    NetworkMonitor.reportSample(sample);
  }

  /**
   * Call this when the player reports a stall/rebuffer. Feeds the
   * hysteresis engine a strong "estimate was too optimistic" signal and
   * immediately re-evaluates (bypassing the switch cooldown), per product
   * rule #27 ("le buffer doit s'adapter au réseau") — a stall is worse
   * for the user than a slightly-too-low quality, so we react fast.
   */
  reportStall(): void {
    if (this.disposed || !this.hasActiveSource) return;
    const now = Date.now();
    // Conservative guess: the connection currently supports at most half
    // of what we were attempting, until real numbers arrive.
    const current = this.adm.getNetworkState(now).estimatedThroughputKbps;
    const guessedKbps = Math.max(150, Math.round(current * 0.5));
    this.adm.reportStall(guessedKbps, now);
    this.tierSwitcher?.reportStall(now);
    NetworkMonitor.reportStall(guessedKbps, now);
    this.reevaluate(true);
    this.reevaluateTier();
  }

  /**
   * Playback error handler — never surfaces the raw native error to the
   * UI (product rule #30). Retries with exponential-ish backoff before
   * giving up, keeping the user inside the player the whole time
   * (product rule #28).
   */
  async handlePlaybackError(reason: PlayerErrorReason = 'unknown'): Promise<void> {
    if (this.disposed) return;

    if (this.reconnectAttempt >= RECONNECT_BACKOFF_MS.length) {
      this.callbacks.onFatalError?.(reason);
      return;
    }

    this.isReconnecting = true;
    const delay = RECONNECT_BACKOFF_MS[this.reconnectAttempt];
    this.reconnectAttempt += 1;
    this.callbacks.onReconnecting?.(this.reconnectAttempt, RECONNECT_BACKOFF_MS.length);

    await new Promise((resolve) => setTimeout(resolve, delay));
    if (this.disposed) return;

    try {
      if (this.tierSwitcher) {
        const failover = this.tierSwitcher.reportTierDead(Date.now());
        if (failover.changed) {
          await this.applyStreamUrl(failover.tier.channel.streamUrl);
          this.isReconnecting = false;
          this.reconnectAttempt = 0;
          this.callbacks.onReconnected?.();
          return;
        }
      }
      // On repeated failures, also nudge the quality decision down —
      // the failure itself is evidence the current rendition isn't safe.
      if (this.reconnectAttempt >= 2) {
        this.reportStall();
      }
      await this.setSource(this.currentStreamUrl || this.lastKnownSafeUrl);
      this.isReconnecting = false;
      this.reconnectAttempt = 0;
      this.callbacks.onReconnected?.();
    } catch {
      await this.handlePlaybackError(reason);
    }
  }

  getIsReconnecting(): boolean {
    return this.isReconnecting;
  }

  dispose(): void {
    this.disposed = true;
    this.hasActiveSource = false;
    this.stopReevaluationLoop();
    this.stopTierLoop();
  }
}
