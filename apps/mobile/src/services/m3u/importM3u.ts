import * as FileSystem from 'expo-file-system';
import { IPTV_CLIENT_USER_AGENT, parseM3u } from '@infiny-stream/shared';
import { M3U_PARSE_CHUNK_SIZE } from '@infiny-stream/config';
import type { M3uFileSource, M3uUrlSource } from '@infiny-stream/types';
import { formatImportSummary, replaceSourceChannels } from '@/services/persistChannels';

export interface ImportProgress {
  phase: 'downloading' | 'parsing' | 'saving';
  parsedCount?: number;
}

export interface ImportResult {
  channelCount: number;
  categoryCount: number;
  duplicatesRemoved: number;
  rejected: number;
  ignored: number;
  summary: string;
  epgUrl?: string;
  warnings: string[];
}

export class M3uImportError extends Error {
  readonly title: string;
  readonly causeLabel: string;

  constructor(title: string, causeLabel: string) {
    super(`${title} — ${causeLabel}`);
    this.name = 'M3uImportError';
    this.title = title;
    this.causeLabel = causeLabel;
  }
}

function httpStatusCause(status: number): string {
  if (status === 401 || status === 403) return `Accès refusé (HTTP ${status})`;
  if (status === 404) return `Playlist introuvable (HTTP ${status})`;
  if (status >= 500) return `Erreur serveur (HTTP ${status})`;
  return `HTTP ${status}`;
}

function downloadCause(err: unknown, url: string): string {
  const message = err instanceof Error ? err.message.toLowerCase() : '';
  if (/timeout|timed out|aborted/.test(message)) return 'Délai dépassé';
  if (url.toLowerCase().startsWith('http://') && /network request failed|failed to fetch|cleartext/.test(message)) {
    return 'HTTP en clair bloqué';
  }
  if (/network request failed|failed to fetch|network error/.test(message)) return 'Connexion impossible';
  return 'Le serveur n’a pas répondu';
}

async function downloadPlaylist(url: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { 'User-Agent': IPTV_CLIENT_USER_AGENT, Accept: '*/*' },
    });
  } catch (err) {
    throw new M3uImportError('Impossible de télécharger la playlist', downloadCause(err, url));
  }
  if (!response.ok) {
    throw new M3uImportError('Impossible de télécharger la playlist', httpStatusCause(response.status));
  }
  try {
    return await response.text();
  } catch {
    throw new M3uImportError('Impossible de télécharger la playlist', 'Réponse illisible');
  }
}

async function readSourceContent(
  source: M3uUrlSource | M3uFileSource,
  onProgress?: (p: ImportProgress) => void
): Promise<string> {
  if (source.type === 'm3u_url') {
    onProgress?.({ phase: 'downloading' });
    return downloadPlaylist(source.url);
  }

  onProgress?.({ phase: 'downloading' });
  try {
    return await FileSystem.readAsStringAsync(source.fileUri);
  } catch {
    throw new M3uImportError('Impossible de lire le fichier', 'Fichier inaccessible');
  }
}

/**
 * Downloads/reads, parses, and persists an M3U source. Duplicate URLs and
 * individual insert failures are counted as ignored rather than aborting
 * the whole playlist.
 */
export async function importM3uSource(
  source: M3uUrlSource | M3uFileSource,
  onProgress?: (p: ImportProgress) => void
): Promise<ImportResult> {
  const content = await readSourceContent(source, onProgress);

  onProgress?.({ phase: 'parsing' });
  let parsed;
  try {
    parsed = await parseM3u(content, {
      chunkSize: M3U_PARSE_CHUNK_SIZE,
      onProgress: (parsedCount) => onProgress?.({ phase: 'parsing', parsedCount }),
    });
  } catch {
    throw new M3uImportError('Impossible d’analyser la playlist', 'Format non reconnu');
  }

  if (parsed.channels.length === 0) {
    throw new M3uImportError('Impossible d’analyser la playlist', 'Aucune chaîne trouvée');
  }

  onProgress?.({ phase: 'saving' });
  const persisted = await replaceSourceChannels(source.id, parsed.channels);
  const ignored = persisted.duplicatesRemoved + persisted.rejected;

  return {
    channelCount: persisted.imported,
    categoryCount: parsed.categories.length,
    duplicatesRemoved: persisted.duplicatesRemoved,
    rejected: persisted.rejected,
    ignored,
    summary: formatImportSummary(persisted.imported, ignored),
    epgUrl: parsed.epgUrl,
    warnings: parsed.warnings,
  };
}
