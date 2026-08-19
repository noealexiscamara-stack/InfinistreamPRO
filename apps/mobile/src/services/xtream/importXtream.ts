import { XtreamClient, type XtreamAuthInfo } from '@infiny-stream/shared';
import type { XtreamSource } from '@infiny-stream/types';
import { formatImportSummary, replaceSourceChannels } from '@/services/persistChannels';
import { buildXtreamChannelsFromFetch } from '@/services/xtream/mapXtreamCatalog';

export interface XtreamImportResult {
  channelCount: number;
  duplicatesRemoved: number;
  rejected: number;
  ignored: number;
  summary: string;
  auth: XtreamAuthInfo;
  vodAvailable: boolean;
  seriesAvailable: boolean;
  vodError?: string;
  seriesError?: string;
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

  const [liveResult, vodResult, seriesResult] = await Promise.all([
    client.getLiveStreams(),
    client.getVodStreams(),
    client.getSeries(),
  ]);

  if (!liveResult.ok) throw new XtreamConnectionError(liveResult.error, liveResult.message);

  const built = buildXtreamChannelsFromFetch(source.id, client, categoryNameById, {
    live: liveResult,
    vod: vodResult,
    series: seriesResult,
  });

  const persisted = await replaceSourceChannels(source.id, built.channels);
  const ignored = persisted.duplicatesRemoved + persisted.rejected;

  return {
    channelCount: persisted.imported,
    duplicatesRemoved: persisted.duplicatesRemoved,
    rejected: persisted.rejected,
    ignored,
    summary: formatImportSummary(persisted.imported, ignored),
    auth,
    vodAvailable: built.vodAvailable,
    seriesAvailable: built.seriesAvailable,
    vodError: built.vodError,
    seriesError: built.seriesError,
  };
}
