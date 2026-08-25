import { CHANNEL_INSERT_BATCH_ROWS, replaceSourceChannels, type PersistableChannel } from '@/services/persistChannels';

jest.mock('@/utils/db', () => ({
  getDatabase: jest.fn(),
}));

import { getDatabase } from '@/utils/db';

class MemoryChannelsDb {
  channels = new Map<string, Record<string, unknown>>();
  categories = new Map<string, Record<string, unknown>>();
  sourceUpdates: Array<{ channelCount: number; sourceId: string }> = [];
  deletedSourceIds: string[] = [];
  runAsyncCount = 0;
  execCalls: string[] = [];
  /** Simulated JS↔native bridge cost per runAsync (ms). */
  bridgeLatencyMs = 0;

  async getFirstAsync<T>(sql: string): Promise<T | null> {
    if (sql.includes('journal_mode')) return { journal_mode: 'wal' } as T;
    return null;
  }

  async getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]> {
    if (sql.includes('FROM categories') && sql.includes('adultManualOverride')) {
      const sourceId = params[0];
      return [...this.categories.values()].filter(
        (c) => (sourceId == null || c.sourceId === sourceId) && c.adultManualOverride != null
      ) as T[];
    }
    return [];
  }

  async execAsync(sql: string): Promise<void> {
    this.execCalls.push(sql);
  }

  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    const snapshot = new Map(this.channels);
    const catSnapshot = new Map(this.categories);
    try {
      await task();
    } catch (error) {
      this.channels = snapshot;
      this.categories = catSnapshot;
      throw error;
    }
  }

  async runAsync(sql: string, ...params: unknown[]): Promise<void> {
    if (this.bridgeLatencyMs > 0) {
      await new Promise((r) => setTimeout(r, this.bridgeLatencyMs));
    }
    this.runAsyncCount++;

    if (sql.startsWith('DELETE FROM channels')) {
      this.deletedSourceIds.push(String(params[0]));
      for (const [id, row] of [...this.channels.entries()]) {
        if (row.sourceId === params[0]) this.channels.delete(id);
      }
      return;
    }
    if (sql.startsWith('DELETE FROM xtream_series_cache')) return;
    if (sql.startsWith('DELETE FROM categories')) {
      const sourceId = String(params[0]);
      for (const [id, row] of [...this.categories.entries()]) {
        if (row.sourceId === sourceId) this.categories.delete(id);
      }
      return;
    }
    if (sql.startsWith('INSERT OR REPLACE INTO categories')) {
      // id, sourceId, kind, name, adultAuto, adultManualOverride, isAdult
      const id = String(params[0]);
      this.categories.set(id, {
        id,
        sourceId: params[1],
        kind: params[2],
        name: params[3],
        adultAuto: params[4],
        adultManualOverride: params[5],
        isAdult: params[6],
      });
      return;
    }
    if (sql.startsWith('UPDATE channels SET isAdult')) return;
    if (sql.startsWith('UPDATE sources SET channelCount')) {
      this.sourceUpdates.push({ channelCount: Number(params[0]), sourceId: String(params[3]) });
      return;
    }
    if (sql.startsWith('INSERT OR REPLACE INTO channels')) {
      // Multi-row: 22 columns per row
      const COLS = 22;
      for (let i = 0; i + COLS - 1 < params.length; i += COLS) {
        const id = String(params[i]);
        this.channels.set(id, {
          id,
          sourceId: params[i + 1],
          name: params[i + 2],
          streamUrl: params[i + 3],
        });
      }
    }
  }
}

function makeChannels(count: number): PersistableChannel[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `Channel ${i + 1}`,
    streamUrl: `http://example.com/live/${i + 1}.m3u8`,
    sortIndex: i,
    kind: i % 3 === 0 ? 'live' : i % 3 === 1 ? 'movie' : 'series',
  })) as PersistableChannel[];
}

describe('replaceSourceChannels', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('persists 50k channels with ~one native call per 500 rows', async () => {
    const db = new MemoryChannelsDb();
    (getDatabase as jest.Mock).mockResolvedValue(db);

    const channels = makeChannels(50_000);
    const result = await replaceSourceChannels('src-large', channels, { sourceType: 'xtream' });

    expect(result.imported).toBe(50_000);
    expect(db.channels.size).toBe(50_000);
    // DELETE ×2 + INSERT batches + UPDATE sources
    const expectedInsertCalls = Math.ceil(50_000 / CHANNEL_INSERT_BATCH_ROWS);
    expect(result.nativeInsertCalls).toBe(expectedInsertCalls);
    expect(result.nativeInsertCalls!).toBeLessThan(200);
    expect(db.sourceUpdates).toEqual([{ channelCount: 50_000, sourceId: 'src-large' }]);
    expect(db.execCalls).toContain('PRAGMA synchronous = OFF');
    expect(db.execCalls.some((c) => c.includes('journal_mode'))).toBe(true);
    expect(db.execCalls).toContain('PRAGMA synchronous = NORMAL');
  });

  it('rolls back channel writes when the transaction fails', async () => {
    const db = new MemoryChannelsDb();
    const failingDb = {
      ...db,
      async runAsync(sql: string, ...params: unknown[]) {
        if (sql.startsWith('UPDATE sources SET channelCount')) {
          throw new Error('simulated sqlite failure');
        }
        return db.runAsync(sql, ...params);
      },
      withTransactionAsync: db.withTransactionAsync.bind(db),
      execAsync: db.execAsync.bind(db),
      getFirstAsync: db.getFirstAsync.bind(db),
      getAllAsync: db.getAllAsync.bind(db),
    };

    (getDatabase as jest.Mock).mockResolvedValue(failingDb);

    await expect(replaceSourceChannels('src-fail', makeChannels(5_000))).rejects.toThrow('simulated sqlite failure');
    expect(db.channels.size).toBe(0);
    expect(db.sourceUpdates).toHaveLength(0);
  });

  it('keeps manual adult override across reimport (auto detection does not wipe it)', async () => {
    const db = new MemoryChannelsDb();
    (getDatabase as jest.Mock).mockResolvedValue(db);

    const channels: PersistableChannel[] = [
      {
        name: 'Film Action',
        streamUrl: 'http://example.com/vod/1.mp4',
        sortIndex: 0,
        kind: 'movie',
        category: 'FR | ACTION',
      },
    ];

    await replaceSourceChannels('src-adult', channels, { sourceType: 'xtream' });
    const cat = [...db.categories.values()].find((c) => c.name === 'FR | ACTION');
    expect(cat).toBeTruthy();
    expect(cat!.adultAuto).toBe(0);
    expect(cat!.isAdult).toBe(0);

    // User marks category adult manually (as setCategoryAdultFlag would).
    cat!.adultManualOverride = 1;
    cat!.isAdult = 1;

    // Reimport same catalog — auto still says not adult.
    await replaceSourceChannels('src-adult', channels, { sourceType: 'xtream' });
    const after = [...db.categories.values()].find((c) => c.name === 'FR | ACTION');
    expect(after).toBeTruthy();
    expect(after!.adultAuto).toBe(0);
    expect(after!.adultManualOverride).toBe(1);
    expect(after!.isAdult).toBe(1);
  });

  it('throttles progress to at most ~1 callback per second (plus final)', async () => {
    const db = new MemoryChannelsDb();
    (getDatabase as jest.Mock).mockResolvedValue(db);

    const progressCalls: number[] = [];
    const channels = makeChannels(5_000); // 10 batches of 500
    await replaceSourceChannels('src-prog', channels, {
      sourceType: 'xtream',
      onProgress: (n) => progressCalls.push(n),
    });

    // Without throttle we'd get 10+; with 1s throttle + final, expect few.
    expect(progressCalls.length).toBeLessThanOrEqual(3);
    expect(progressCalls[progressCalls.length - 1]).toBe(5_000);
  });

  it('is ~40× fewer native calls than the old per-row pattern (bridge bottleneck)', async () => {
    const ROW_COUNT = 10_000;
    const BRIDGE_MS = 2; // ~500 rows/s old path ≈ 2ms per await

    // --- AFTER: multi-row ---
    const dbAfter = new MemoryChannelsDb();
    dbAfter.bridgeLatencyMs = BRIDGE_MS;
    (getDatabase as jest.Mock).mockResolvedValue(dbAfter);
    const t0 = Date.now();
    const after = await replaceSourceChannels('src-bench', makeChannels(ROW_COUNT), { sourceType: 'xtream' });
    const afterMs = Date.now() - t0;
    const afterRps = Math.round(ROW_COUNT / (afterMs / 1000));

    // --- BEFORE (simulated): one await per row ---
    const beforeCalls = ROW_COUNT;
    const beforeMs = beforeCalls * BRIDGE_MS;
    const beforeRps = Math.round(ROW_COUNT / (beforeMs / 1000));

    console.log(
      `[bench] BEFORE≈${beforeRps} rows/s (${beforeCalls} native calls) | AFTER=${afterRps} rows/s (${after.nativeInsertCalls} native calls)`
    );

    expect(after.nativeInsertCalls).toBe(Math.ceil(ROW_COUNT / CHANNEL_INSERT_BATCH_ROWS));
    expect(after.nativeInsertCalls!).toBeLessThan(beforeCalls / 40);
    expect(afterRps).toBeGreaterThan(beforeRps * 10);
  });
});
