import type { BufferOptions, VideoPlayer, VideoSource } from 'expo-video';
import { ChannelTierSwitcher } from '@infiny-stream/shared';
import type { GroupedChannel, QualityMode } from '@infiny-stream/types';
import { NetworkMonitor } from '@/services/network/NetworkMonitor';

/**
 * Thin glue around expo-video / Media3 (ExoPlayer on Android).
 *
 * Architecture (intentional):
 * - HLS master playlists are handed to the native player AS-IS. ExoPlayer's
 *   own ABR measures real segment downloads — we do not replace that with a
 *   JS estimate derived from a 2 KB manifest.
 * - Single-rendition URLs (.ts, media playlists) are also passed through.
 * - Our layer only: buffer tuning from the user quality mode, reconnect on
 *   real player errors, coarse playlist-tier failover, and read-only status
 *   from NetworkMonitor (system connectivity).
 *
 * expo-video limitation (verified against ~57.0.x types): there is NO JS API
 * for max bitrate / max resolution / preferredPeakBitRate. Quality modes can
 * only influence `bufferOptions`. A native module would be needed to cap
 * Media3's TrackSelectionParameters.
 */

export type PlayerErrorReason = 'network' | 'source' | 'unknown';

export interface PlayerControllerCallbacks {
  /** Called for a *user-facing* error (never a raw native exception message). */
  onFatalError?: (reason: PlayerErrorReason) => void;
  onReconnecting?: (attempt: number, maxAttempts: number) => void;
  onReconnected?: () => void;
}

const RECONNECT_BACKOFF_MS = [0, 1000, 2000, 5000, 10000];

/**
 * Buffer profiles — the only lever expo-video gives us for quality modes.
 * Tuned like IPTV players that configure ExoPlayer rather than replacing ABR.
 */
const BUFFER_BY_MODE: Record<QualityMode, BufferOptions> = {
  auto: {
    preferredForwardBufferDuration: 20,
    minBufferForPlayback: 2,
    prioritizeTimeOverSizeThreshold: true,
  },
  economy: {
    preferredForwardBufferDuration: 12,
    minBufferForPlayback: 1.5,
    maxBufferBytes: 6_000_000,
    prioritizeTimeOverSizeThreshold: true,
  },
  balanced: {
    preferredForwardBufferDuration: 25,
    minBufferForPlayback: 2.5,
    prioritizeTimeOverSizeThreshold: true,
  },
  quality: {
    preferredForwardBufferDuration: 40,
    minBufferForPlayback: 3,
    prioritizeTimeOverSizeThreshold: false,
  },
};

function isLikelyHls(url: string): boolean {
  return /\.m3u8(\?|$)/i.test(url);
}

export class PlayerController {
  private readonly player: VideoPlayer;
  private callbacks: PlayerControllerCallbacks = {};
  private tierSwitcher: ChannelTierSwitcher | null = null;
  private reconnectAttempt = 0;
  private isReconnecting = false;
  private currentStreamUrl = '';
  private lastKnownSafeUrl = '';
  private hasActiveSource = false;
  private qualityMode: QualityMode = 'auto';
  private disposed = false;
  private unsubNetwork: (() => void) | null = null;
  /** Wall-clock when the current source was handed to the player. */
  private loadStartedAtMs = 0;

  constructor(player: VideoPlayer) {
    this.player = player;
    this.applyBufferOptions(this.qualityMode);
  }

  setCallbacks(callbacks: PlayerControllerCallbacks): void {
    this.callbacks = callbacks;
  }

  getMode(): QualityMode {
    return this.qualityMode;
  }

  /**
   * Persists the quality mode and retunes buffer options.
   * Does not retarget the playing URL — ExoPlayer keeps adapting inside the master.
   * Does not apply a bitrate/resolution ceiling (expo-video has no such API).
   */
  setMode(mode: QualityMode): void {
    this.qualityMode = mode;
    this.applyBufferOptions(mode);
  }

  attachChannelGroup(group: GroupedChannel): string {
    this.tierSwitcher = new ChannelTierSwitcher(group);
    return this.tierSwitcher.currentTier().channel.streamUrl;
  }

  /**
   * Loads a channel URL into the native player.
   * Master HLS → full master URI (native ABR). Direct / single-variant → URI as-is.
   * Never samples throughput from a manifest download.
   */
  async loadChannel(directUrl: string): Promise<void> {
    if (this.disposed) return;
    this.reconnectAttempt = 0;
    this.hasActiveSource = false;
    await this.setSource(directUrl);
    if (this.disposed) return;
    this.hasActiveSource = true;
    this.ensureNetworkSubscription();
  }

  private applyBufferOptions(mode: QualityMode): void {
    try {
      this.player.bufferOptions = BUFFER_BY_MODE[mode];
      console.log(`[Player] bufferOptions applied mode=${mode}`, BUFFER_BY_MODE[mode]);
    } catch (cause) {
      console.warn('[Player] bufferOptions not applied', cause);
    }
  }

  private ensureNetworkSubscription(): void {
    if (this.unsubNetwork) return;
    // Read-only: NetworkMonitor never stops playback. We only keep the
    // subscription so logs stay correlated with the active session.
    this.unsubNetwork = NetworkMonitor.subscribe((state) => {
      console.log(
        `[Player] network status quality=${state.quality} type=${state.connectionType} kbps=${state.estimatedThroughputKbps}`
      );
    });
  }

  private async setSource(url: string): Promise<void> {
    if (this.disposed) return;
    this.currentStreamUrl = url;
    this.lastKnownSafeUrl = url;
    this.loadStartedAtMs = Date.now();
    const source: VideoSource = isLikelyHls(url)
      ? { uri: url, contentType: 'hls' }
      : { uri: url };
    console.log(`[Player] setSource hls=${isLikelyHls(url)} url=${url.slice(0, 120)}`);
    this.player.replace(source);
    if (!this.disposed) this.player.play();
  }

  getCurrentStreamUrl(): string {
    return this.currentStreamUrl || this.lastKnownSafeUrl;
  }

  /** Ms since the last setSource — used for failure diagnostics. */
  getTimeSinceLoadMs(): number {
    if (!this.loadStartedAtMs) return 0;
    return Math.max(0, Date.now() - this.loadStartedAtMs);
  }

  /**
   * Playback error handler — only real player failures interrupt / reconnect.
   * Throughput estimates never enter this path.
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
          console.log(`[Tier] failover applied label=${failover.tier.label} reason=${failover.reason}`);
          await this.setSource(failover.tier.channel.streamUrl);
          this.isReconnecting = false;
          this.reconnectAttempt = 0;
          this.callbacks.onReconnected?.();
          return;
        }
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

  getHasActiveSource(): boolean {
    return this.hasActiveSource && !this.disposed;
  }

  dispose(): void {
    this.disposed = true;
    this.hasActiveSource = false;
    this.unsubNetwork?.();
    this.unsubNetwork = null;
  }
}

/** Documented for callers / docs: what expo-video exposes vs what we cannot do. */
export const EXPO_VIDEO_CAPABILITIES = {
  bufferOptions: true,
  availableVideoTracksReadOnly: true,
  maxBitrateOrResolutionCap: false,
  nativeAbrWhenGivenMasterPlaylist: true,
} as const;
