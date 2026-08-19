import { XtreamClient, type XtreamSeriesInfo } from '@infiny-stream/shared';
import type { XtreamSource } from '@infiny-stream/types';
import { getDatabase } from '@/utils/db';
import {
  isXtreamSeriesPlaceholder,
  upsertSeriesEpisodes,
  xtreamSeriesPlaceholderUrl,
} from '@/services/persistChannels';
import { mapXtreamSeriesEpisodes } from '@/services/xtream/mapXtreamCatalog';

const CACHE_TTL_MS = 1000 * 60 * 60 * 24;

function clientFor(source: Pick<XtreamSource, 'serverUrl' | 'username' | 'password'>): XtreamClient {
  return new XtreamClient({ serverUrl: source.serverUrl, username: source.username, password: source.password });
}

async function readCache(sourceId: string, seriesId: number): Promise<XtreamSeriesInfo | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ payload: string; fetchedAt: string }>(
    `SELECT payload, fetchedAt FROM xtream_series_cache WHERE sourceId = ? AND seriesId = ?`,
    sourceId,
    seriesId
  );
  if (!row) return null;
  if (Date.now() - new Date(row.fetchedAt).getTime() > CACHE_TTL_MS) return null;
  return JSON.parse(row.payload) as XtreamSeriesInfo;
}

async function writeCache(sourceId: string, info: XtreamSeriesInfo): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO xtream_series_cache (sourceId, seriesId, payload, fetchedAt) VALUES (?, ?, ?, ?)`,
    sourceId,
    info.seriesId,
    JSON.stringify(info),
    new Date().toISOString()
  );
}

export async function loadXtreamSeriesInfo(
  source: XtreamSource,
  seriesId: number,
  seriesTitle: string
): Promise<XtreamSeriesInfo> {
  const cached = await readCache(source.id, seriesId);
  if (cached) {
    await persistEpisodes(source, seriesId, seriesTitle, cached);
    return cached;
  }

  const client = clientFor(source);
  const result = await client.getSeriesInfo(seriesId);
  if (!result.ok) throw new Error(result.message);

  await writeCache(source.id, result.data);
  await persistEpisodes(source, seriesId, seriesTitle, result.data);
  return result.data;
}

async function persistEpisodes(
  source: XtreamSource,
  seriesId: number,
  seriesTitle: string,
  info: XtreamSeriesInfo
): Promise<void> {
  const client = clientFor(source);
  const episodes = mapXtreamSeriesEpisodes(source, seriesId, seriesTitle, info, client);
  await upsertSeriesEpisodes(source.id, episodes);
}

export { isXtreamSeriesPlaceholder, xtreamSeriesPlaceholderUrl };
