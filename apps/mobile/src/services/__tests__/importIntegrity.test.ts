/**
 * Non-regression: large Xtream catalog import must preserve exact URLs.
 *
 * Scenario that must never regress:
 * - 50k+ mixed live / movie / series rows
 * - numeric stream_id reused across kinds (live 42 ≠ movie 42)
 * - duplicate provider ids within a kind with different URLs (first URL wins)
 * - after dedupe + persist, every surviving row maps to its expected URL
 */
import {
  CHANNEL_INSERT_BATCH_ROWS,
  replaceSourceChannels,
  type PersistableChannel,
} from '@/services/persistChannels';
import { channelId, dedupeChannelsByUrl, dedupeXtreamByProviderId } from '@infiny-stream/shared';

jest.mock('@/utils/db', () => ({
  getDatabase: jest.fn(),
}));

import { getDatabase } from '@/utils/db';

const SOURCE = 'src-integrity';
const BASE = 'http://provider.example';

class IntegrityDb {
  channels = new Map<
    string,
    {
      id: string;
      streamUrl: string;
      kind: string;
      xtreamStreamId: number | null;
      xtreamSeriesId: number | null;
      name: string;
    }
  >();

  async getFirstAsync<T>(sql: string): Promise<T | null> {
    if (sql.includes('journal_mode')) return { journal_mode: 'wal' } as T;
    return null;
  }

  async getAllAsync<T>(): Promise<T[]> {
    return [];
  }

  async execAsync(): Promise<void> {}

  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    await task();
  }

  async runAsync(sql: string, ...params: unknown[]): Promise<void> {
    if (sql.startsWith('DELETE FROM channels')) {
      this.channels.clear();
      return;
    }
    if (
      sql.startsWith('DELETE FROM categories') ||
      sql.startsWith('DELETE FROM xtream_series_cache') ||
      sql.startsWith('INSERT OR REPLACE INTO categories') ||
      sql.startsWith('UPDATE channels SET isAdult') ||
      sql.startsWith('UPDATE sources SET channelCount')
    ) {
      return;
    }
    if (sql.startsWith('INSERT OR REPLACE INTO channels')) {
      const COLS = 22;
      for (let i = 0; i + COLS - 1 < params.length; i += COLS) {
        const id = String(params[i]);
        this.channels.set(id, {
          id,
          streamUrl: String(params[i + 3]),
          kind: String(params[i + 12]),
          xtreamStreamId: params[i + 18] == null ? null : Number(params[i + 18]),
          xtreamSeriesId: params[i + 19] == null ? null : Number(params[i + 19]),
          name: String(params[i + 2]),
        });
      }
    }
  }
}

function liveUrl(id: number, ext: 'm3u8' | 'ts' = 'm3u8'): string {
  return `${BASE}/live/u/p/${id}.${ext}`;
}
function movieUrl(id: number, ext = 'mp4'): string {
  return `${BASE}/movie/u/p/${id}.${ext}`;
}
function seriesPlaceholder(id: number): string {
  return `infiny-stream://xtream/series/${SOURCE}/${id}`;
}

/**
 * Builds ≥50k rows:
 * - 30_000 unique live
 * - 15_000 unique movies
 * - 5_000 unique series headers
 * - PLUS poisoned duplicates that would corrupt URLs if last-write-wins
 */
function buildLargeCatalog(): {
  raw: PersistableChannel[];
  expectedUrlByKey: Map<string, string>;
  expectedCount: number;
} {
  const raw: PersistableChannel[] = [];
  const expectedUrlByKey = new Map<string, string>();
  let sort = 0;

  for (let i = 1; i <= 30_000; i++) {
    const url = liveUrl(i);
    raw.push({
      name: `Live ${i}`,
      streamUrl: url,
      sortIndex: sort++,
      kind: 'live',
      xtreamStreamId: i,
      category: i % 10 === 0 ? 'AF | NEWS' : 'FR | GENERAL',
    });
    expectedUrlByKey.set(`live:${i}`, url);
  }

  for (let i = 1; i <= 15_000; i++) {
    const url = movieUrl(i, 'mp4');
    raw.push({
      name: `Movie ${i}`,
      streamUrl: url,
      sortIndex: sort++,
      kind: 'movie',
      xtreamStreamId: i,
      containerExtension: 'mp4',
      category: 'FR | ACTION',
    });
    expectedUrlByKey.set(`movie:${i}`, url);
  }

  for (let i = 1; i <= 5_000; i++) {
    const url = seriesPlaceholder(i);
    raw.push({
      name: `Series ${i}`,
      streamUrl: url,
      sortIndex: sort++,
      kind: 'series',
      xtreamSeriesId: i,
      category: 'EN | DRAMA',
    });
    expectedUrlByKey.set(`series:${i}`, url);
  }

  // Poison: same live stream_id, wrong second URL — first must win.
  raw.push({
    name: 'Live 7 DUP',
    streamUrl: liveUrl(7, 'ts'),
    sortIndex: sort++,
    kind: 'live',
    xtreamStreamId: 7,
    category: 'AF | NEWS',
  });

  // Poison: same movie stream_id, different container — first (mp4) must win.
  raw.push({
    name: 'Movie 99 DUP',
    streamUrl: movieUrl(99, 'mkv'),
    sortIndex: sort++,
    kind: 'movie',
    xtreamStreamId: 99,
    containerExtension: 'mkv',
    category: 'FR | ACTION',
  });

  // Shared numeric id across kinds — both must survive with their own URL.
  // live:42 and movie:42 already exist above; assert both expected keys present.

  const expectedCount = 30_000 + 15_000 + 5_000; // poisons drop
  return { raw, expectedUrlByKey, expectedCount };
}

describe('Xtream import URL integrity (50k+)', () => {
  it('dedupe keeps first URL per (kind, xtreamStreamId) and exact expected URLs', () => {
    const { raw, expectedUrlByKey, expectedCount } = buildLargeCatalog();
    expect(raw.length).toBeGreaterThanOrEqual(50_000);

    const byUrl = dedupeChannelsByUrl(raw);
    const { channels, duplicatesRemoved } = dedupeXtreamByProviderId(byUrl.channels);

    expect(duplicatesRemoved).toBeGreaterThanOrEqual(2);
    expect(channels.length).toBe(expectedCount);

    // No duplicate provider keys
    const providerKeys = new Set<string>();
    for (const ch of channels) {
      let key: string | null = null;
      if (ch.xtreamSeriesId != null && ch.kind === 'series' && !ch.xtreamEpisodeId) {
        key = `series:${ch.xtreamSeriesId}`;
      } else if (ch.xtreamStreamId != null && ch.kind) {
        key = `${ch.kind}:${ch.xtreamStreamId}`;
      }
      if (key) {
        expect(providerKeys.has(key)).toBe(false);
        providerKeys.add(key);
      }
    }

    // Exact URL for every expected entry (including shared numeric ids across kinds)
    const urlByKey = new Map<string, string>();
    for (const ch of channels) {
      if (ch.kind === 'series' && ch.xtreamSeriesId != null) {
        urlByKey.set(`series:${ch.xtreamSeriesId}`, ch.streamUrl);
      } else if (ch.xtreamStreamId != null && ch.kind) {
        urlByKey.set(`${ch.kind}:${ch.xtreamStreamId}`, ch.streamUrl);
      }
    }

    expect(urlByKey.get('live:7')).toBe(liveUrl(7, 'm3u8'));
    expect(urlByKey.get('live:7')).not.toBe(liveUrl(7, 'ts'));
    expect(urlByKey.get('movie:99')).toBe(movieUrl(99, 'mp4'));
    expect(urlByKey.get('movie:99')).not.toBe(movieUrl(99, 'mkv'));
    expect(urlByKey.get('live:42')).toBe(liveUrl(42));
    expect(urlByKey.get('movie:42')).toBe(movieUrl(42));

    for (const [key, expectedUrl] of expectedUrlByKey) {
      expect(urlByKey.get(key)).toBe(expectedUrl);
    }

    // channelId uniqueness after persist-shaped ids
    const ids = channels.map((c) => channelId(SOURCE, c.streamUrl));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('replaceSourceChannels persists exact URLs (INSERT OR REPLACE cannot swap wrong row)', async () => {
    const { raw, expectedUrlByKey, expectedCount } = buildLargeCatalog();
    const db = new IntegrityDb();
    (getDatabase as jest.Mock).mockResolvedValue(db);

    const result = await replaceSourceChannels(SOURCE, raw, { sourceType: 'xtream' });
    expect(result.imported).toBe(expectedCount);
    expect(db.channels.size).toBe(expectedCount);
    expect(result.nativeInsertCalls).toBe(Math.ceil(expectedCount / CHANNEL_INSERT_BATCH_ROWS));

    const byKey = new Map<string, string>();
    for (const row of db.channels.values()) {
      if (row.kind === 'series' && row.xtreamSeriesId != null) {
        byKey.set(`series:${row.xtreamSeriesId}`, row.streamUrl);
      } else if (row.xtreamStreamId != null) {
        byKey.set(`${row.kind}:${row.xtreamStreamId}`, row.streamUrl);
      }
    }

    // IntegrityDb must store xtreamStreamId from bind params — column index 18
    // If live rows lack xtreamStreamId in map, this assertion catches it.
    expect(byKey.get('live:7')).toBe(liveUrl(7, 'm3u8'));
    expect(byKey.get('movie:99')).toBe(movieUrl(99, 'mp4'));

    for (const [key, expectedUrl] of expectedUrlByKey) {
      expect(byKey.get(key)).toBe(expectedUrl);
    }

    // No duplicate (kind, xtreamStreamId) among rows that have stream ids
    const seen = new Set<string>();
    for (const row of db.channels.values()) {
      if (row.xtreamStreamId == null) continue;
      const key = `${row.kind}:${row.xtreamStreamId}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  }, 120_000);
});
