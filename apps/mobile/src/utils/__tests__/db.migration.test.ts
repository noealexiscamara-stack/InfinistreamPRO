import {
  INITIAL_SCHEMA,
  columnExists,
  getSchemaVersion,
  runSchemaMigrations,
  type MigrationDb,
} from '@/utils/dbMigrations';

type Row = Record<string, unknown>;
type TableColumns = Map<string, Set<string>>;

class MemoryMigrationDb implements MigrationDb {
  private tables: TableColumns = new Map();
  private rows: Map<string, Row[]> = new Map();
  private userVersion = 0;

  constructor() {
    this.execSync(INITIAL_SCHEMA);
  }

  private cloneState(): { tables: TableColumns; rows: Map<string, Row[]>; userVersion: number } {
    const tables: TableColumns = new Map();
    for (const [table, columns] of this.tables.entries()) {
      tables.set(table, new Set(columns));
    }
    const rows = new Map<string, Row[]>();
    for (const [table, tableRows] of this.rows.entries()) {
      rows.set(
        table,
        tableRows.map((row) => ({ ...row }))
      );
    }
    return { tables, rows, userVersion: this.userVersion };
  }

  private restoreState(snapshot: { tables: TableColumns; rows: Map<string, Row[]>; userVersion: number }): void {
    this.tables = snapshot.tables;
    this.rows = snapshot.rows;
    this.userVersion = snapshot.userVersion;
  }

  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    const snapshot = this.cloneState();
    try {
      await task();
    } catch (error) {
      this.restoreState(snapshot);
      throw error;
    }
  }

  private execSync(sql: string): void {
    const statements = sql
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean);

    for (const statement of statements) {
      this.execOne(statement);
    }
  }

  private execOne(statement: string): void {
    const sql = statement.replace(/\s+/g, ' ').trim();
    if (sql.startsWith('PRAGMA journal_mode')) return;

    if (sql.startsWith('PRAGMA user_version =')) {
      this.userVersion = Number(sql.split('=')[1]?.trim());
      return;
    }

    const createMatch = sql.match(/^CREATE TABLE IF NOT EXISTS (\w+) \((.+)\)$/i);
    if (createMatch) {
      const table = createMatch[1];
      const columns = this.parseColumns(createMatch[2]);
      this.ensureTable(table, columns);
      return;
    }

    const createIndexMatch = sql.match(/^CREATE INDEX IF NOT EXISTS (\w+) ON (\w+)\((.+)\)$/i);
    if (createIndexMatch) return;

    const alterMatch = sql.match(/^ALTER TABLE (\w+) ADD COLUMN (\w+) (.+)$/i);
    if (alterMatch) {
      const [, table, column] = alterMatch;
      this.addColumn(table, column);
      return;
    }

    const insertMatch = sql.match(/^INSERT INTO (\w+) \(([^)]+)\) VALUES \(([^)]+)\)$/i);
    if (insertMatch) {
      const [, table, columnsPart, valuesPart] = insertMatch;
      const columns = columnsPart.split(',').map((c) => c.trim());
      const values = valuesPart.split(',').map((v) => this.parseValue(v.trim()));
      const row: Row = {};
      columns.forEach((column, index) => {
        row[column] = values[index];
      });
      this.insertRow(table, row);
      return;
    }

    throw new Error(`Unsupported SQL in migration test mock: ${sql}`);
  }

  private parseColumns(definition: string): string[] {
    return definition
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.length > 0 && !part.startsWith('FOREIGN KEY') && !part.startsWith('PRIMARY KEY'))
      .map((part) => part.split(/\s+/)[0]);
  }

  private ensureTable(table: string, columns: string[]): void {
    if (!this.tables.has(table)) {
      this.tables.set(table, new Set());
      this.rows.set(table, []);
    }
    for (const column of columns) {
      this.addColumn(table, column);
    }
  }

  private addColumn(table: string, column: string): void {
    if (!this.tables.has(table)) {
      this.tables.set(table, new Set());
      this.rows.set(table, []);
    }
    const tableColumns = this.tables.get(table)!;
    if (!tableColumns.has(column)) {
      tableColumns.add(column);
    }
    for (const row of this.rows.get(table) ?? []) {
      if (!(column in row)) {
        row[column] = null;
      }
    }
  }

  private insertRow(table: string, row: Row): void {
    const tableColumns = this.tables.get(table);
    if (!tableColumns) throw new Error(`Missing table ${table}`);
    for (const column of tableColumns.keys()) {
      if (!(column in row)) row[column] = null;
    }
    this.rows.get(table)!.push(row);
  }

  private parseValue(raw: string): unknown {
    if (raw.startsWith("'") && raw.endsWith("'")) {
      return raw.slice(1, -1);
    }
    if (raw === 'NULL') return null;
    if (/^-?\d+$/.test(raw)) return Number(raw);
    if (/^-?\d+\.\d+$/.test(raw)) return Number(raw);
    return raw;
  }

  async execAsync(sql: string): Promise<void> {
    this.execSync(sql);
  }

  async getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]> {
    if (sql.startsWith('PRAGMA table_info(')) {
      const table = sql.match(/PRAGMA table_info\((\w+)\)/)?.[1];
      if (!table) return [];
      const columns = [...(this.tables.get(table)?.keys() ?? [])];
      return columns.map((name) => ({ name })) as T[];
    }

    if (sql.startsWith('PRAGMA user_version')) {
      return [{ user_version: this.userVersion }] as T[];
    }

    if (sql.startsWith('SELECT id, name, streamUrl, groupTitle, category FROM channels')) {
      return (this.rows.get('channels') ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        streamUrl: row.streamUrl,
        groupTitle: row.groupTitle,
        category: row.category,
      })) as T[];
    }

    if (
      sql.includes('FROM channels c') &&
      sql.includes('INNER JOIN sources s') &&
      sql.includes("s.type IN ('m3u_url', 'm3u_file')")
    ) {
      const m3uSourceIds = new Set(
        (this.rows.get('sources') ?? [])
          .filter((row) => row.type === 'm3u_url' || row.type === 'm3u_file')
          .map((row) => row.id)
      );
      return (this.rows.get('channels') ?? [])
        .filter((row) => m3uSourceIds.has(row.sourceId))
        .map((row) => ({
          id: row.id,
          name: row.name,
          streamUrl: row.streamUrl,
          groupTitle: row.groupTitle,
          category: row.category,
        })) as T[];
    }

    if (sql.startsWith('SELECT id, kind, sourceId FROM channels')) {
      return (this.rows.get('channels') ?? []).map((row) => ({
        id: row.id,
        kind: row.kind,
        sourceId: row.sourceId,
      })) as T[];
    }

    if (sql.startsWith('SELECT id, name FROM sources')) {
      return (this.rows.get('sources') ?? []) as T[];
    }

    if (sql.startsWith('SELECT channelId FROM favorites')) {
      return (this.rows.get('favorites') ?? []) as T[];
    }

    if (sql.startsWith('SELECT channelId, channelName FROM history')) {
      return (this.rows.get('history') ?? []) as T[];
    }

    if (sql.startsWith('SELECT id, kind FROM channels')) {
      const rows = [...(this.rows.get('channels') ?? [])].sort(
        (a, b) => Number(a.sortIndex ?? 0) - Number(b.sortIndex ?? 0)
      );
      return rows.map((row) => ({ id: row.id, kind: row.kind })) as T[];
    }

    if (sql.startsWith('SELECT COUNT(*) as count FROM channels')) {
      return [{ count: this.rows.get('channels')?.length ?? 0 }] as T[];
    }

    throw new Error(`Unsupported SQL query in migration test mock: ${sql} ${params.join(', ')}`);
  }

  async getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null> {
    const rows = await this.getAllAsync<T>(sql, ...params);
    return rows[0] ?? null;
  }

  async prepareAsync(sql: string) {
    if (!sql.startsWith('UPDATE channels SET kind = $kind WHERE id = $id')) {
      throw new Error(`Unsupported prepared statement: ${sql}`);
    }
    return {
      executeAsync: async (params: Record<string, unknown>) => {
        const rows = this.rows.get('channels') ?? [];
        const row = rows.find((entry) => entry.id === params.$id);
        if (row) row.kind = params.$kind;
      },
      finalizeAsync: async () => undefined,
    };
  }
}

async function seedLegacyDatabase(db: MemoryMigrationDb): Promise<void> {
  await db.execAsync(`
    INSERT INTO sources (id, type, name, payload, createdAt, updatedAt, channelCount)
    VALUES ('src1', 'm3u_url', 'Ma playlist', 'payload', '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z', 2)
  `);
  await db.execAsync(`
    INSERT INTO channels (id, sourceId, name, streamUrl, sortIndex, category)
    VALUES ('ch1', 'src1', 'TF1', 'http://example.com/live/tf1.m3u8', 0, 'France')
  `);
  await db.execAsync(`
    INSERT INTO channels (id, sourceId, name, streamUrl, sortIndex, category)
    VALUES ('ch2', 'src1', 'Inception', 'http://example.com/movie/inception.mkv', 1, 'Films')
  `);
  await db.execAsync(`
    INSERT INTO favorites (channelId, sourceId, addedAt)
    VALUES ('ch1', 'src1', '2024-01-02T00:00:00.000Z')
  `);
  await db.execAsync(`
    INSERT INTO history (channelId, sourceId, channelName, lastWatchedAt)
    VALUES ('ch1', 'src1', 'TF1', '2024-01-03T00:00:00.000Z')
  `);
}

async function seedManyChannels(db: MemoryMigrationDb, count: number): Promise<void> {
  await db.execAsync(`
    INSERT INTO sources (id, type, name, payload, createdAt, updatedAt, channelCount)
    VALUES ('src1', 'm3u_url', 'Gros bouquet', 'payload', '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z', ${count})
  `);
  for (let i = 0; i < count; i += 1) {
    await db.execAsync(`
      INSERT INTO channels (id, sourceId, name, streamUrl, sortIndex, category)
      VALUES ('ch${i}', 'src1', 'Ch ${i}', 'http://example.com/live/${i}.m3u8', ${i}, 'Live')
    `);
  }
}

async function seedV2MisclassifiedM3u(db: MemoryMigrationDb): Promise<void> {
  await db.execAsync(`ALTER TABLE channels ADD COLUMN kind TEXT`);
  await db.execAsync(`
    INSERT INTO sources (id, type, name, payload, createdAt, updatedAt, channelCount)
    VALUES ('m3u1', 'm3u_url', 'Playlist live', 'payload', '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z', 3)
  `);
  await db.execAsync(`
    INSERT INTO sources (id, type, name, payload, createdAt, updatedAt, channelCount)
    VALUES ('x1', 'xtream', 'Xtream', 'payload', '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z', 2)
  `);
  await db.execAsync(`
    INSERT INTO channels (id, sourceId, name, streamUrl, sortIndex, category, kind)
    VALUES ('m1', 'm3u1', 'Canal+ Cinéma', 'http://cdn.example.com/canal.m3u8', 0, '🎬 CINEMA & FILMS', 'movie')
  `);
  await db.execAsync(`
    INSERT INTO channels (id, sourceId, name, streamUrl, sortIndex, category, kind)
    VALUES ('m2', 'm3u1', 'Serie Max', 'http://cdn.example.com/serie.m3u8', 1, '📺 SÉRIES', 'series')
  `);
  await db.execAsync(`
    INSERT INTO channels (id, sourceId, name, streamUrl, sortIndex, category, kind)
    VALUES ('m3', 'm3u1', 'RFI', 'http://cdn.example.com/rfi.mp3', 2, '🎵 MUSIQUE', 'radio')
  `);
  await db.execAsync(`
    INSERT INTO channels (id, sourceId, name, streamUrl, sortIndex, category, kind)
    VALUES ('x1', 'x1', 'Le Parrain', 'http://p:8080/movie/u/p/2.mkv', 0, 'Films', 'movie')
  `);
  await db.execAsync(`
    INSERT INTO channels (id, sourceId, name, streamUrl, sortIndex, category, kind)
    VALUES ('x2', 'x1', 'Breaking Bad S01E01', 'http://p:8080/series/u/p/3.mkv', 1, 'Series', 'series')
  `);
  await db.execAsync(`PRAGMA user_version = 2`);
}

describe('SQLite schema migrations', () => {
  it('upgrades a v0 database without losing sources, favorites or history', async () => {
    const db = new MemoryMigrationDb();
    await seedLegacyDatabase(db);

    expect(await getSchemaVersion(db)).toBe(0);
    expect(await columnExists(db, 'channels', 'kind')).toBe(false);

    await runSchemaMigrations(db);

    expect(await getSchemaVersion(db)).toBe(3);
    expect(await columnExists(db, 'channels', 'kind')).toBe(true);
    expect(await columnExists(db, 'channels', 'containerExtension')).toBe(true);

    expect(await db.getAllAsync(`SELECT id, name FROM sources`)).toEqual([
      expect.objectContaining({ id: 'src1', name: 'Ma playlist' }),
    ]);
    expect(await db.getAllAsync(`SELECT channelId FROM favorites`)).toEqual([
      expect.objectContaining({ channelId: 'ch1' }),
    ]);
    expect(await db.getAllAsync(`SELECT channelId, channelName FROM history`)).toEqual([
      expect.objectContaining({ channelId: 'ch1', channelName: 'TF1' }),
    ]);

    const channels = await db.getAllAsync<{ id: string; kind: string }>(
      `SELECT id, kind FROM channels ORDER BY sortIndex ASC`
    );
    expect(channels).toHaveLength(2);
    expect(channels[0].kind).toBe('live');
    expect(channels[1].kind).toBe('live');
  });

  it('is idempotent when migrations run twice', async () => {
    const db = new MemoryMigrationDb();
    await seedLegacyDatabase(db);

    await runSchemaMigrations(db);
    await runSchemaMigrations(db);

    expect(await getSchemaVersion(db)).toBe(3);
    expect(await db.getFirstAsync(`SELECT COUNT(*) as count FROM channels`)).toEqual({ count: 2 });
  });

  it('rolls back a failed v1 migration and replays it fully on restart', async () => {
    const db = new MemoryMigrationDb();
    await seedManyChannels(db, 4);

    await expect(runSchemaMigrations(db, { failBackfillAfter: 2 })).rejects.toThrow(
      'Migration interrompue pendant le backfill'
    );

    expect(await getSchemaVersion(db)).toBe(0);
    expect(await columnExists(db, 'channels', 'kind')).toBe(false);
    expect(await db.getFirstAsync(`SELECT COUNT(*) as count FROM channels`)).toEqual({ count: 4 });

    await runSchemaMigrations(db);

    expect(await getSchemaVersion(db)).toBe(3);
    expect(await columnExists(db, 'channels', 'kind')).toBe(true);
    const channels = await db.getAllAsync<{ id: string; kind: string }>(`SELECT id, kind FROM channels`);
    expect(channels).toHaveLength(4);
    expect(channels.every((row) => row.kind === 'live')).toBe(true);
  });

  it('v3 reclassifies mis-tagged M3U channels to live without touching Xtream', async () => {
    const db = new MemoryMigrationDb();
    await seedV2MisclassifiedM3u(db);

    expect(await getSchemaVersion(db)).toBe(2);

    await runSchemaMigrations(db);

    expect(await getSchemaVersion(db)).toBe(3);

    const channels = await db.getAllAsync<{ id: string; kind: string; sourceId: string }>(
      `SELECT id, kind, sourceId FROM channels`
    );

    expect(channels.find((c) => c.id === 'm1')?.kind).toBe('live');
    expect(channels.find((c) => c.id === 'm2')?.kind).toBe('live');
    expect(channels.find((c) => c.id === 'm3')?.kind).toBe('radio');
    expect(channels.find((c) => c.id === 'x1')?.kind).toBe('movie');
    expect(channels.find((c) => c.id === 'x2')?.kind).toBe('series');
  });
});
