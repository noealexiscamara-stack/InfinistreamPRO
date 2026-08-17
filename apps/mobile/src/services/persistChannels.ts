import { channelId } from '@infiny-stream/shared';
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

/**
 * Atomically replaces every channel row belonging to `sourceId` with the
 * freshly parsed/fetched set. Shared by the M3U and Xtream importers so a
 * refresh from either protocol behaves identically from storage's point of
 * view. Runs inside a single transaction: on failure the old channels are
 * left untouched rather than the source ending up empty.
 */
export async function replaceSourceChannels(sourceId: string, channels: PersistableChannel[]): Promise<void> {
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM channels WHERE sourceId = ?', sourceId);

    if (channels.length > 0) {
      const statement = await db.prepareAsync(
        `INSERT INTO channels
          (id, sourceId, name, streamUrl, logoUrl, groupTitle, tvgId, tvgName, country, category, sortIndex)
         VALUES ($id, $sourceId, $name, $streamUrl, $logoUrl, $groupTitle, $tvgId, $tvgName, $country, $category, $sortIndex)`
      );
      try {
        for (const ch of channels) {
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
        }
      } finally {
        await statement.finalizeAsync();
      }
    }

    const now = new Date().toISOString();
    await db.runAsync(
      `UPDATE sources SET channelCount = ?, lastRefreshedAt = ?, lastError = NULL, updatedAt = ? WHERE id = ?`,
      channels.length,
      now,
      now,
      sourceId
    );
  });
}
