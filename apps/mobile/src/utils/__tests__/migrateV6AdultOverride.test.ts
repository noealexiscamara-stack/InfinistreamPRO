import {
  migrateV6_adultManualOverride,
  type MigrationDb,
} from '@/utils/dbMigrations';
import { categoryRowId } from '@/utils/adultCategory';

/** Minimal in-memory migration DB for adult override tests. */
class MemDb implements MigrationDb {
  categories = new Map<
    string,
    { id: string; name: string; isAdult: number; adultAuto?: number; adultManualOverride?: number | null }
  >();
  columns = new Set(['id', 'sourceId', 'kind', 'name', 'isAdult']);

  async execAsync(sql: string): Promise<void> {
    if (sql.includes('ADD COLUMN adultAuto')) this.columns.add('adultAuto');
    if (sql.includes('ADD COLUMN adultManualOverride')) this.columns.add('adultManualOverride');
  }

  async getAllAsync<T>(sql: string): Promise<T[]> {
    if (sql.includes('PRAGMA table_info')) {
      return [...this.columns].map((name) => ({ name })) as T[];
    }
    if (sql.includes('FROM categories')) {
      return [...this.categories.values()] as T[];
    }
    return [];
  }

  async getFirstAsync<T>(): Promise<T | null> {
    return null;
  }

  async prepareAsync(sql: string) {
    return {
      executeAsync: async (params: Record<string, unknown>) => {
        if (sql.includes('UPDATE categories SET adultAuto')) {
          const row = this.categories.get(String(params.$id));
          if (!row) return;
          row.adultAuto = Number(params.$auto);
          row.adultManualOverride = params.$override == null ? null : Number(params.$override);
          row.isAdult = Number(params.$effective);
        }
      },
      finalizeAsync: async () => undefined,
    };
  }

  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    await task();
  }
}

describe('migrateV6_adultManualOverride', () => {
  it('stores override when prior isAdult differs from name-based auto', async () => {
    const db = new MemDb();
    const id = categoryRowId('src', 'movie', 'FR | ACTION');
    db.categories.set(id, { id, name: 'FR | ACTION', isAdult: 1 });

    await migrateV6_adultManualOverride(db);

    const row = db.categories.get(id)!;
    expect(row.adultAuto).toBe(0);
    expect(row.adultManualOverride).toBe(1);
    expect(row.isAdult).toBe(1);
  });

  it('leaves override null when isAdult matches auto detection', async () => {
    const db = new MemDb();
    const id = categoryRowId('src', 'movie', 'FR | XXX');
    db.categories.set(id, { id, name: 'FR | XXX', isAdult: 1 });

    await migrateV6_adultManualOverride(db);

    const row = db.categories.get(id)!;
    expect(row.adultAuto).toBe(1);
    expect(row.adultManualOverride).toBeNull();
    expect(row.isAdult).toBe(1);
  });
});
