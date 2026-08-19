import { XtreamClient, type XtreamAuthInfo } from '@infiny-stream/shared';
import type { XtreamSource } from '@infiny-stream/types';
import {
  formatImportSummary,
  replaceSourceChannels,
  xtreamSeriesPlaceholderUrl,
  type PersistableChannel,
} from '@/services/persistChannels';

export interface XtreamImportResult {
  channelCount: number;
  duplicatesRemoved: number;
  rejected: number;
  ignored: number;
  summary: string;
  auth: XtreamAuthInfo;
}

const XTREAM_TITLE = 'Impossible de se connecter au serveur Xtream';

function xtreamCauseForKind(
  kind: 'network' | 'invalid_credentials' | 'server_error' | 'malformed_response',
  fallback?: string
): string {
  switch (kind) {
    case 'invalid_credentials':
      return fallback || 'Identifiants incorrects';
    case 'network':
      return 'Connexion impossible';
    case 'server_error':
      return fallback || 'Erreur serveur';
    case 'malformed_response':
      return fallback || 'Réponse inattendue';
  }
}

export class XtreamConnectionError extends Error {
  readonly title = XTREAM_TITLE;
  readonly causeLabel: string;

  constructor(
    public readonly kind: 'network' | 'invalid_credentials' | 'server_error' | 'malformed_response',
    causeLabel?: string
  ) {
    const cause = xtreamCauseForKind(kind, causeLabel);
    super(`${XTREAM_TITLE} — ${cause}`);
    this.name = 'XtreamConnectionError';
    this.causeLabel = cause;
  }
}

function clientFor(source: Pick<XtreamSource, 'serverUrl' | 'username' | 'password'>): XtreamClient {
  return new XtreamClient({ serverUrl: source.serverUrl, username: source.username, password: source.password });
}

export async function verifyXtreamCredentials(
  credentials: Pick<XtreamSource, 'serverUrl' | 'username' | 'password'>
): Promise<XtreamAuthInfo> {
  const client = clientFor(credentials);
  const result = await client.authenticate();
  if (!result.ok) {
    throw new XtreamConnectionError(result.error, result.message);
  }
  if (result.data.status !== 'ok') {
    throw new XtreamConnectionError(
      'invalid_credentials',
      result.data.status === 'expired' ? 'Abonnement Xtream expiré' : 'Compte Xtream désactivé'
    );
  }
  return result.data;
}

export async function importXtreamSource(source: XtreamSource): Promise<XtreamImportResult> {
  const client = clientFor(source);
  const auth = await verifyXtreamCredentials(source);

  const [liveCategories, vodCategories, seriesCategories] = await Promise.all([
    client.getLiveCategories(),
    client.getVodCategories(),
    client.getSeriesCategories(),
  ]);

  if (!liveCategories.ok) throw new XtreamConnectionError(liveCategories.error, liveCategories.message);

  const categoryNameById = new Map<string, string>();
  for (const list of [liveCategories, vodCategories, seriesCategories]) {
    if (list.ok) {
      for (const c of list.data) categoryNameById.set(c.categoryId, c.categoryName);
    }
  }

  const [streamsResult, vodResult, seriesResult] = await Promise.all([
    client.getLiveStreams(),
    client.getVodStreams(),
    client.getSeries(),
  ]);

  if (!streamsResult.ok) throw new XtreamConnectionError(streamsResult.error, streamsResult.message);

  const channels: PersistableChannel[] = [];
  let sortIndex = 0;

  for (const stream of streamsResult.data) {
    channels.push({
      name: stream.name,
      streamUrl: client.buildLiveStreamUrl(stream.streamId),
      logoUrl: stream.streamIcon,
      groupTitle: categoryNameById.get(stream.categoryId),
      category: categoryNameById.get(stream.categoryId),
      tvgId: stream.epgChannelId,
      sortIndex: sortIndex++,
      kind: 'live',
    });
  }

  if (vodResult.ok) {
    for (const vod of vodResult.data) {
      channels.push({
        name: vod.name,
        streamUrl: client.buildVodStreamUrl(vod.streamId, vod.containerExtension),
        logoUrl: vod.icon,
        groupTitle: categoryNameById.get(vod.categoryId),
        category: categoryNameById.get(vod.categoryId),
        sortIndex: sortIndex++,
        kind: 'movie',
        rating: vod.rating,
        releaseDate: vod.added,
        containerExtension: vod.containerExtension,
        xtreamStreamId: vod.streamId,
      });
    }
  }

  if (seriesResult.ok) {
    for (const series of seriesResult.data) {
      channels.push({
        name: series.name,
        streamUrl: xtreamSeriesPlaceholderUrl(source.id, series.seriesId),
        logoUrl: series.cover,
        groupTitle: categoryNameById.get(series.categoryId),
        category: categoryNameById.get(series.categoryId),
        sortIndex: sortIndex++,
        kind: 'series',
        plot: series.plot,
        genre: series.genre,
        rating: series.rating,
        releaseDate: series.releaseDate,
        xtreamSeriesId: series.seriesId,
      });
    }
  }

  const persisted = await replaceSourceChannels(source.id, channels);
  const ignored = persisted.duplicatesRemoved + persisted.rejected;

  return {
    channelCount: persisted.imported,
    duplicatesRemoved: persisted.duplicatesRemoved,
    rejected: persisted.rejected,
    ignored,
    summary: formatImportSummary(persisted.imported, ignored),
    auth,
  };
}
