import { XtreamClient, type XtreamAuthInfo } from '@infiny-stream/shared';
import type { XtreamSource } from '@infiny-stream/types';
import { formatImportSummary, replaceSourceChannels, type PersistableChannel } from '@/services/persistChannels';

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

/** Validates Xtream credentials without importing anything — used by the "Connexion Xtream" screen before saving the source. */
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

/**
 * Fetches every live category + channel from an Xtream Codes server and
 * persists it the same way an M3U import would. Kept as a separate module
 * from services/m3u on purpose — different protocol, different error
 * modes (auth expiry, connection limits) — see product rule #13.
 */
export async function importXtreamSource(source: XtreamSource): Promise<XtreamImportResult> {
  const client = clientFor(source);

  const auth = await verifyXtreamCredentials(source);

  const categoriesResult = await client.getLiveCategories();
  if (!categoriesResult.ok) {
    throw new XtreamConnectionError(categoriesResult.error, categoriesResult.message);
  }
  const categoryNameById = new Map(categoriesResult.data.map((c) => [c.categoryId, c.categoryName]));

  const streamsResult = await client.getLiveStreams();
  if (!streamsResult.ok) {
    throw new XtreamConnectionError(streamsResult.error, streamsResult.message);
  }

  const channels: PersistableChannel[] = streamsResult.data.map((stream, index) => ({
    name: stream.name,
    streamUrl: client.buildLiveStreamUrl(stream.streamId),
    logoUrl: stream.streamIcon,
    groupTitle: categoryNameById.get(stream.categoryId),
    category: categoryNameById.get(stream.categoryId),
    tvgId: stream.epgChannelId,
    sortIndex: index,
  }));

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
