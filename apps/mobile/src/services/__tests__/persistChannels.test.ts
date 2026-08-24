import { ARRAY_APPEND_BATCH } from '@infiny-stream/shared';
import { replaceSourceChannels, type PersistableChannel } from '@/services/persistChannels';

jest.mock('@/utils/db', () => ({
  getDatabase: jest.fn(),
}));

import { getDatabase } from '@/utils/db';

type BoundParams = Record<string, unknown>;

class MemoryChannelsDb {
  channels = new Map<string, BoundParams>();
  sourceUpdates: Array<{ channelCount: number; sourceId: string }> = [];
  deletedSourceIds: string[] = [];
  executeCount = 0;

  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    const snapshot = new Map(this.channels);
    try {
      await task();
    } catch (error) {
      this.channels = snapshot;
      throw error;
    }
  }

  async runAsync(sql: string, ...params: unknown[]): Promise<void> {
    if (sql.startsWith('DELETE FROM channels')) {
      this.deletedSourceIds.push(String(params[0]));
      for (const [id, row] of [...this.channels.entries()]) {
        if (row.$sourceId === params[0]) this.channels.delete(id);
      }
      return;
    }
    if (sql.startsWith('DELETE FROM xtream_series_cache')) return;
    if (sql.startsWith('UPDATE sources SET channelCount')) {
      this.sourceUpdates.push({ channelCount: Number(params[0]), sourceId: String(params[3]) });
    }
  }

  async prepareAsync() {
    const db = this;
    return {
      async executeAsync(params: BoundParams) {
        db.channels.set(String(params.$id), params);
        db.executeCount++;
      },
      async finalizeAsync() {},
    };
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

  it('persists 50k channels in batches inside one transaction', async () => {
    const db = new MemoryChannelsDb();
    (getDatabase as jest.Mock).mockResolvedValue(db);

    const channels = makeChannels(50_000);
    const result = await replaceSourceChannels('src-large', channels, { sourceType: 'xtream' });

    expect(result.imported).toBe(50_000);
    expect(db.channels.size).toBe(50_000);
    expect(db.executeCount).toBe(50_000);
    expect(db.sourceUpdates).toEqual([{ channelCount: 50_000, sourceId: 'src-large' }]);
    expect(db.executeCount / ARRAY_APPEND_BATCH).toBeGreaterThanOrEqual(49);
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
      prepareAsync: db.prepareAsync.bind(db),
    };

    (getDatabase as jest.Mock).mockResolvedValue(failingDb);

    await expect(replaceSourceChannels('src-fail', makeChannels(5_000))).rejects.toThrow('simulated sqlite failure');
    expect(db.channels.size).toBe(0);
    expect(db.sourceUpdates).toHaveLength(0);
  });
});
