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
      response = await this.fetchFn(url);
    } catch (err) {
      return { ok: false, error: 'network', message: err instanceof Error ? err.message : 'Erreur réseau' };
    }

    if (response.status === 401 || response.status === 403) {
      return { ok: false, error: 'invalid_credentials', message: 'Identifiants Xtream invalides' };
    }
    if (!response.ok) {
      return { ok: false, error: 'server_error', message: `Le serveur a répondu ${response.status}` };
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
    const result = await this.request<any[]>(this.apiUrl('get_live_categories'));
    if (!result.ok) return result;
    if (!Array.isArray(result.data)) {
      return { ok: false, error: 'malformed_response', message: 'Liste de catégories inattendue' };
    }
    return {
      ok: true,
      data: result.data.map((c) => ({ categoryId: String(c.category_id), categoryName: String(c.category_name) })),
    };
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
}
