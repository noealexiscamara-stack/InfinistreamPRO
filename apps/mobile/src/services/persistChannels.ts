import { channelId, dedupeChannelsByUrl, groupChannelsByQuality } from '@infiny-stream/shared';
import type { Channel } from '@infiny-stream/types';
import { getDatabase } from '@/utils/db';

export interface PersistableChannel {
  name: string;
  streamUrl: string;
  logoUrl?: string;
  groupTitle?: string;
  tvgId?: string;
  tvgName?: string;
  country?: string;
  category?: string;
  sortIndex: number;
}

export interface PersistChannelsResult {
  imported: number;
  duplicatesRemoved: number;
  rejected: number;
}

export function formatImportSummary(imported: number, ignored: number): string {
  if (ignored > 0) return `${imported} chaînes importées, ${ignored} ignorées`;
  return `${imported} chaînes importées`;
}

/**
 * Replaces every channel row belonging to `sourceId` with the freshly
 * parsed/fetched set. Shared by the M3U and Xtream importers so a refresh
 * from either protocol behaves identically from storage's point of view.
 *
 * Duplicate URLs are collapsed first (same URL → same primary key). Each
 * remaining row is inserted independently with INSERT OR REPLACE: one
 * bad row must not abort the rest of the playlist, and a re-import must
 * not die on a leftover key.
 */
export async function replaceSourceChannels(
  sourceId: string,
  channels: PersistableChannel[]
): Promise<PersistChannelsResult> {
  const { channels: unique, duplicatesRemoved } = dedupeChannelsByUrl(channels);

  const asChannels: Channel[] = unique.map((ch) => ({
    id: channelId(sourceId, ch.streamUrl),
    sourceId,
    name: ch.name,
    streamUrl: ch.streamUrl,
    logoUrl: ch.logoUrl,
    groupTitle: ch.groupTitle,
    tvgId: ch.tvgId,
    tvgName: ch.tvgName,
    country: ch.country,
    category: ch.category,
    sortIndex: ch.sortIndex,
  }));
  groupChannelsByQuality(asChannels);

  const db = await getDatabase();
  let imported = 0;
  let rejected = 0;

  await db.runAsync('DELETE FROM channels WHERE sourceId = ?', sourceId);

  if (unique.length > 0) {
    const statement = await db.prepareAsync(
      `INSERT OR REPLACE INTO channels
        (id, sourceId, name, streamUrl, logoUrl, groupTitle, tvgId, tvgName, country, category, sortIndex)
       VALUES ($id, $sourceId, $name, $streamUrl, $logoUrl, $groupTitle, $tvgId, $tvgName, $country, $category, $sortIndex)`
    );
    try {
      for (const ch of unique) {
        try {
          await statement.executeAsync({
            $id: channelId(sourceId, ch.streamUrl),
            $sourceId: sourceId,
            $name: ch.name,
            $streamUrl: ch.streamUrl,
            $logoUrl: ch.logoUrl ?? null,
            $groupTitle: ch.groupTitle ?? null,
            $tvgId: ch.tvgId ?? null,
            $tvgName: ch.tvgName ?? null,
            $country: ch.country ?? null,
            $category: ch.category ?? null,
            $sortIndex: ch.sortIndex,
          });
          imported++;
        } catch {
          rejected++;
        }
      }
    } finally {
      await statement.finalizeAsync();
    }
  }

  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE sources SET channelCount = ?, lastRefreshedAt = ?, lastError = NULL, updatedAt = ? WHERE id = ?`,
    imported,
    now,
    now,
    sourceId
  );

  return { imported, duplicatesRemoved, rejected };
}
