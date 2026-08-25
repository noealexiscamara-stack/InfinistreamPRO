import type { BufferOptions, VideoPlayer } from 'expo-video';
import { ChannelTierSwitcher } from '@infiny-stream/shared';
import type { GroupedChannel, QualityMode } from '@infiny-stream/types';
import { NetworkMonitor } from '@/services/network/NetworkMonitor';
import {
  alternateLiveStreamUrl,
  buildStreamVideoSource,
  isLikelyHls,
} from '@/services/playback/streamSource';

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
 *
 * Buffer mapping (expo-video → ExoPlayer mental model):
 * - preferredForwardBufferDuration (seconds) ≈ target buffer ahead of playhead
 * - minBufferForPlayback (seconds) ≈ bufferForPlaybackMs / 1000
 * - There is no separate bufferForPlaybackAfterRebufferMs in expo-video;
 *   ExoPlayer uses the same min buffer threshold after a rebuffer.
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
 * Buffer profiles — tuned for IPTV live on unstable links (competitors buffer
 * 15–30 s before starting; our previous 2 s min caused segment-bound stalls).
 *
 * Values are in **seconds** (expo-video BufferOptions API).
 */
export const BUFFER_BY_MODE: Record<QualityMode, BufferOptions> = {
  auto: {
    preferredForwardBufferDuration: 30,
    minBufferForPlayback: 8,
    prioritizeTimeOverSizeThreshold: true,
  },
  economy: {
    preferredForwardBufferDuration: 20,
    minBufferForPlayback: 6,
    maxBufferBytes: 8_000_000,
    prioritizeTimeOverSizeThreshold: true,
  },
  balanced: {
    preferredForwardBufferDuration: 35,
    minBufferForPlayback: 10,
    prioritizeTimeOverSizeThreshold: true,
  },
  quality: {
    preferredForwardBufferDuration: 45,
    minBufferForPlayback: 12,
    prioritizeTimeOverSizeThreshold: false,
  },
};

/** Human-readable ms equivalents for diagnostics / support. */
export const BUFFER_BY_MODE_MS: Record<
  QualityMode,
  {
    preferredForwardBufferMs: number;
    minBufferForPlaybackMs: number;
    bufferForPlaybackAfterRebufferMs: number;
    maxBufferBytes: number | null;
  }
> = {
  auto: {
    preferredForwardBufferMs: 30_000,
    minBufferForPlaybackMs: 8_000,
    bufferForPlaybackAfterRebufferMs: 8_000,
    maxBufferBytes: null,
  },
  economy: {
    preferredForwardBufferMs: 20_000,
    minBufferForPlaybackMs: 6_000,
    bufferForPlaybackAfterRebufferMs: 6_000,
    maxBufferBytes: 8_000_000,
  },
  balanced: {
    preferredForwardBufferMs: 35_000,
    minBufferForPlaybackMs: 10_000,
    bufferForPlaybackAfterRebufferMs: 10_000,
    maxBufferBytes: null,
  },
  quality: {
    preferredForwardBufferMs: 45_000,
    minBufferForPlaybackMs: 12_000,
    bufferForPlaybackAfterRebufferMs: 12_000,
    maxBufferBytes: null,
  },
};

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
  /** Bumps on every load/release so stale async work is ignored. */
  private loadSeq = 0;
  private sourceSessionId = 0;

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
   * Drops the native stream so provider connection slots are freed immediately.
   * Must run before loading another URL or leaving the player screen.
   */
  async releaseSource(reason: string, options?: { cancelPending?: boolean }): Promise<void> {
    if (this.disposed) return;
    if (options?.cancelPending) this.loadSeq += 1;
    const releasedUrl = this.currentStreamUrl || this.lastKnownSafeUrl;
    const session = this.sourceSessionId;

    if (releasedUrl) {
      console.log(`[Player] source RELEASE reason=${reason} session=${session} url=${releasedUrl.slice(0, 120)}`);
    }

    try {
      this.player.pause();
    } catch {
      /* player may already be idle */
    }

    try {
      this.player.replace(null);
    } catch (cause) {
      console.warn('[Player] replace(null) failed', cause);
    }

    this.hasActiveSource = false;
    this.currentStreamUrl = '';
    this.isReconnecting = false;
    this.reconnectAttempt = 0;
  }

  /**
   * Loads a channel URL into the native player.
   * Always releases any previous source first — one open stream at a time.
   */
  async loadChannel(directUrl: string): Promise<void> {
    if (this.disposed) return;
    const seq = ++this.loadSeq;
    await this.releaseSource('loadChannel-preempt');
    if (this.disposed || seq !== this.loadSeq) return;

    this.reconnectAttempt = 0;
    await this.setSource(directUrl, seq);
    if (this.disposed || seq !== this.loadSeq) return;
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
    this.unsubNetwork = NetworkMonitor.subscribe((state) => {
      console.log(
        `[Player] network status quality=${state.quality} type=${state.connectionType} kbps=${state.estimatedThroughputKbps}`
      );
    });
  }

  private async setSource(url: string, loadSeq: number): Promise<void> {
    if (this.disposed || loadSeq !== this.loadSeq) return;

    this.currentStreamUrl = url;
    this.lastKnownSafeUrl = url;
    this.loadStartedAtMs = Date.now();
    this.sourceSessionId += 1;
    const session = this.sourceSessionId;
    const source = buildStreamVideoSource(url);

    console.log(`[Player] source OPEN session=${session} hls=${isLikelyHls(url)} url=${url.slice(0, 120)}`);

    this.player.replace(source);
    if (!this.disposed && loadSeq === this.loadSeq) this.player.play();
  }

  getCurrentStreamUrl(): string {
    return this.currentStreamUrl || this.lastKnownSafeUrl;
  }

  getTimeSinceLoadMs(): number {
    if (!this.loadStartedAtMs) return 0;
    return Math.max(0, Date.now() - this.loadStartedAtMs);
  }

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

    await this.releaseSource(`reconnect-attempt-${this.reconnectAttempt}`);
    await new Promise((resolve) => setTimeout(resolve, delay));
    if (this.disposed) return;

    const seq = this.loadSeq;

    try {
      if (this.tierSwitcher) {
        const failover = this.tierSwitcher.reportTierDead(Date.now());
        if (failover.changed) {
          console.log(`[Tier] failover applied label=${failover.tier.label} reason=${failover.reason}`);
          await this.setSource(failover.tier.channel.streamUrl, seq);
          if (this.disposed || seq !== this.loadSeq) return;
          this.isReconnecting = false;
          this.reconnectAttempt = 0;
          this.hasActiveSource = true;
          this.callbacks.onReconnected?.();
          return;
        }
      }

      let nextUrl = this.lastKnownSafeUrl;
      if (this.reconnectAttempt >= 2) {
        const alt = alternateLiveStreamUrl(nextUrl);
        if (alt) {
          console.log(`[Player] trying alternate live format url=${alt.slice(0, 120)}`);
          nextUrl = alt;
        }
      }

      await this.setSource(nextUrl, seq);
      if (this.disposed || seq !== this.loadSeq) return;
      this.isReconnecting = false;
      this.reconnectAttempt = 0;
      this.hasActiveSource = true;
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
    if (this.disposed) return;
    this.disposed = true;
    void this.releaseSource('dispose');
    this.unsubNetwork?.();
    this.unsubNetwork = null;
  }
}

export const EXPO_VIDEO_CAPABILITIES = {
  bufferOptions: true,
  availableVideoTracksReadOnly: true,
  maxBitrateOrResolutionCap: false,
  nativeAbrWhenGivenMasterPlaylist: true,
  streamHeaders: true,
} as const;
