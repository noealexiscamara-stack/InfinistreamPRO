import { IPTV_CLIENT_USER_AGENT } from '../network/userAgent';

export interface XtreamCredentials {
  serverUrl: string;
  username: string;
  password: string;
}

export interface XtreamAuthInfo {
  status: 'ok' | 'expired' | 'disabled' | 'invalid';
  expiresAt?: string;
  activeConnections?: number;
  maxConnections?: number;
  message?: string;
}

export interface XtreamCategory {
  categoryId: string;
  categoryName: string;
}

export interface XtreamLiveStream {
  streamId: number;
  name: string;
  categoryId: string;
  streamIcon?: string;
  epgChannelId?: string;
}

/**
 * A film. `containerExtension` matters more than it looks: unlike live
 * streams, VOD playback URLs must carry the provider's own container
 * (.mkv, .mp4...), and guessing it wrong yields a 404 rather than a
 * playable file.
 */
export interface XtreamVodStream {
  streamId: number;
  name: string;
  categoryId: string;
  icon?: string;
  containerExtension: string;
  rating?: number;
  added?: string;
}

/** A series, as listed. Episodes require a second call — see getSeriesInfo. */
export interface XtreamSeries {
  seriesId: number;
  name: string;
  categoryId: string;
  cover?: string;
  plot?: string;
  rating?: number;
  releaseDate?: string;
  genre?: string;
}

export interface XtreamEpisode {
  episodeId: string;
  season: number;
  episode: number;
  title: string;
  containerExtension: string;
  plot?: string;
  durationSeconds?: number;
}

export interface XtreamSeriesInfo {
  seriesId: number;
  cover?: string;
  plot?: string;
  genre?: string;
  releaseDate?: string;
  /** Every episode across every season, flattened and ordered. */
  episodes: XtreamEpisode[];
  seasons: number[];
}

export type XtreamResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: 'network' | 'invalid_credentials' | 'server_error' | 'malformed_response'; message: string };

type FetchFn = typeof fetch;

function normalizeServerUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/**
 * Thin client around the Xtream Codes "player_api.php" surface. Kept
 * separate from the M3U parser on purpose (see Étape 13 of the build
 * plan): the two protocols share nothing beyond "produces a list of
 * channels" and mixing their error handling makes both harder to reason
 * about.
 */
export class XtreamClient {
  private readonly credentials: XtreamCredentials;
  private readonly fetchFn: FetchFn;

  constructor(credentials: XtreamCredentials, fetchFn: FetchFn = fetch) {
    this.credentials = { ...credentials, serverUrl: normalizeServerUrl(credentials.serverUrl) };
    this.fetchFn = fetchFn;
  }

  private apiUrl(action?: string, params: Record<string, string> = {}): string {
    const { serverUrl, username, password } = this.credentials;
    const search = new URLSearchParams({
      username,
      password,
      ...(action ? { action } : {}),
      ...params,
    });
    return `${serverUrl}/player_api.php?${search.toString()}`;
  }

  /** Builds the direct playback URL for a live stream (no player_api round trip needed to watch). */
  buildLiveStreamUrl(streamId: number, extension: 'ts' | 'm3u8' = 'm3u8'): string {
    const { serverUrl, username, password } = this.credentials;
    return `${serverUrl}/live/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${streamId}.${extension}`;
  }

  private async request<T>(url: string): Promise<XtreamResult<T>> {
    let response: Response;
    try {
      response = await this.fetchFn(url, {
        headers: { 'User-Agent': IPTV_CLIENT_USER_AGENT, Accept: 'application/json,*/*' },
      });
    } catch (err) {
      return { ok: false, error: 'network', message: err instanceof Error ? err.message : 'Erreur réseau' };
    }

    if (response.status === 401 || response.status === 403) {
      return { ok: false, error: 'invalid_credentials', message: 'Identifiants Xtream invalides' };
    }
    if (!response.ok) {
      return { ok: false, error: 'server_error', message: `Erreur serveur (HTTP ${response.status})` };
    }

    try {
      const data = (await response.json()) as T;
      return { ok: true, data };
    } catch {
      return { ok: false, error: 'malformed_response', message: 'Réponse du serveur illisible' };
    }
  }

  async authenticate(): Promise<XtreamResult<XtreamAuthInfo>> {
    const result = await this.request<any>(this.apiUrl());
    if (!result.ok) return result;

    const userInfo = result.data?.user_info;
    if (!userInfo) {
      return { ok: false, error: 'malformed_response', message: "Réponse d'authentification inattendue" };
    }
    if (userInfo.auth === 0) {
      return { ok: false, error: 'invalid_credentials', message: 'Identifiants Xtream invalides' };
    }

    const statusRaw = String(userInfo.status ?? 'Active').toLowerCase();
    const status: XtreamAuthInfo['status'] =
      statusRaw === 'active' ? 'ok' : statusRaw === 'expired' ? 'expired' : statusRaw === 'disabled' ? 'disabled' : 'invalid';

    return {
      ok: true,
      data: {
        status,
        expiresAt: userInfo.exp_date ? new Date(Number(userInfo.exp_date) * 1000).toISOString() : undefined,
        activeConnections: userInfo.active_cons !== undefined ? Number(userInfo.active_cons) : undefined,
        maxConnections: userInfo.max_connections !== undefined ? Number(userInfo.max_connections) : undefined,
      },
    };
  }

  async getLiveCategories(): Promise<XtreamResult<XtreamCategory[]>> {
    return this.categories('get_live_categories');
  }

  async getLiveStreams(categoryId?: string): Promise<XtreamResult<XtreamLiveStream[]>> {
    const result = await this.request<any[]>(
      this.apiUrl('get_live_streams', categoryId ? { category_id: categoryId } : {})
    );
    if (!result.ok) return result;
    if (!Array.isArray(result.data)) {
      return { ok: false, error: 'malformed_response', message: 'Liste de chaînes inattendue' };
    }
    return {
      ok: true,
      data: result.data.map((s) => ({
        streamId: Number(s.stream_id),
        name: String(s.name),
        categoryId: String(s.category_id),
        streamIcon: s.stream_icon || undefined,
        epgChannelId: s.epg_channel_id || undefined,
      })),
    };
  }

  // --- Films -------------------------------------------------------------

  async getVodCategories(): Promise<XtreamResult<XtreamCategory[]>> {
    return this.categories('get_vod_categories');
  }

  async getVodStreams(categoryId?: string): Promise<XtreamResult<XtreamVodStream[]>> {
    const result = await this.request<any[]>(
      this.apiUrl('get_vod_streams', categoryId ? { category_id: categoryId } : {})
    );
    if (!result.ok) return result;
    if (!Array.isArray(result.data)) {
      return { ok: false, error: 'malformed_response', message: 'Liste de films inattendue' };
    }
    return {
      ok: true,
      data: result.data.map((v) => ({
        streamId: Number(v.stream_id),
        name: String(v.name ?? ''),
        categoryId: String(v.category_id ?? ''),
        icon: v.stream_icon || v.cover || undefined,
        containerExtension: String(v.container_extension || 'mp4').replace(/^\./, ''),
        rating: toNumberOrUndefined(v.rating),
        added: v.added ? new Date(Number(v.added) * 1000).toISOString() : undefined,
      })),
    };
  }

  buildVodStreamUrl(streamId: number, containerExtension: string): string {
    const { serverUrl, username, password } = this.credentials;
    const ext = containerExtension.replace(/^\./, '') || 'mp4';
    return `${serverUrl}/movie/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${streamId}.${ext}`;
  }

  // --- Séries ------------------------------------------------------------

  async getSeriesCategories(): Promise<XtreamResult<XtreamCategory[]>> {
    return this.categories('get_series_categories');
  }

  async getSeries(categoryId?: string): Promise<XtreamResult<XtreamSeries[]>> {
    const result = await this.request<any[]>(
      this.apiUrl('get_series', categoryId ? { category_id: categoryId } : {})
    );
    if (!result.ok) return result;
    if (!Array.isArray(result.data)) {
      return { ok: false, error: 'malformed_response', message: 'Liste de séries inattendue' };
    }
    return {
      ok: true,
      data: result.data.map((x) => ({
        seriesId: Number(x.series_id),
        name: String(x.name ?? ''),
        categoryId: String(x.category_id ?? ''),
        cover: x.cover || undefined,
        plot: x.plot || undefined,
        rating: toNumberOrUndefined(x.rating),
        releaseDate: x.releaseDate || x.release_date || undefined,
        genre: x.genre || undefined,
      })),
    };
  }

  async getSeriesInfo(seriesId: number): Promise<XtreamResult<XtreamSeriesInfo>> {
    const result = await this.request<any>(this.apiUrl('get_series_info', { series_id: String(seriesId) }));
    if (!result.ok) return result;

    const raw = result.data;
    if (!raw || typeof raw !== 'object') {
      return { ok: false, error: 'malformed_response', message: 'Détail de série inattendu' };
    }

    const episodes: XtreamEpisode[] = [];
    const bySeason = raw.episodes ?? {};

    if (bySeason && typeof bySeason === 'object') {
      for (const [seasonKey, list] of Object.entries(bySeason)) {
        if (!Array.isArray(list)) continue;
        const seasonFromKey = Number(seasonKey);
        for (const ep of list) {
          const info = ep?.info ?? {};
          episodes.push({
            episodeId: String(ep?.id ?? ''),
            season: Number.isFinite(seasonFromKey) ? seasonFromKey : Number(ep?.season) || 0,
            episode: Number(ep?.episode_num ?? 0),
            title: String(ep?.title ?? ''),
            containerExtension: String(ep?.container_extension || 'mp4').replace(/^\./, ''),
            plot: info.plot || undefined,
            durationSeconds: toNumberOrUndefined(info.duration_secs),
          });
        }
      }
    }

    episodes.sort((a, b) => a.season - b.season || a.episode - b.episode);

    const info = raw.info ?? {};
    return {
      ok: true,
      data: {
        seriesId,
        cover: info.cover || undefined,
        plot: info.plot || undefined,
        genre: info.genre || undefined,
        releaseDate: info.releaseDate || info.release_date || undefined,
        episodes,
        seasons: [...new Set(episodes.map((e) => e.season))].sort((a, b) => a - b),
      },
    };
  }

  buildEpisodeStreamUrl(episodeId: string, containerExtension: string): string {
    const { serverUrl, username, password } = this.credentials;
    const ext = containerExtension.replace(/^\./, '') || 'mp4';
    return `${serverUrl}/series/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${episodeId}.${ext}`;
  }

  private async categories(action: string): Promise<XtreamResult<XtreamCategory[]>> {
    const result = await this.request<any[]>(this.apiUrl(action));
    if (!result.ok) return result;
    if (!Array.isArray(result.data)) {
      return { ok: false, error: 'malformed_response', message: 'Liste de catégories inattendue' };
    }
    return {
      ok: true,
      data: result.data.map((c) => ({ categoryId: String(c.category_id), categoryName: String(c.category_name) })),
    };
  }
}

function toNumberOrUndefined(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}
