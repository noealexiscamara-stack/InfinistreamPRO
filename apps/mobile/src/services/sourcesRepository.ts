import { sourceId as generateSourceId } from '@infiny-stream/shared';
import type { Source, SourceType } from '@infiny-stream/types';
import { getDatabase } from '@/utils/db';

interface SourceRow {
  id: string;
  type: SourceType;
  name: string;
  payload: string;
  createdAt: string;
  updatedAt: string;
  lastRefreshedAt: string | null;
  channelCount: number | null;
  lastError: string | null;
}

function rowToSource(row: SourceRow): Source {
  const payload = JSON.parse(row.payload);
  const base = {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastRefreshedAt: row.lastRefreshedAt ?? undefined,
    channelCount: row.channelCount ?? undefined,
    lastError: row.lastError ?? undefined,
  };
  return { ...base, type: row.type, ...payload } as Source;
}

function payloadOf(source: Omit<Source, 'id' | 'name' | 'type' | 'createdAt' | 'updatedAt' | 'lastRefreshedAt' | 'channelCount' | 'lastError'>) {
  return JSON.stringify(source);
}

export async function listSources(): Promise<Source[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<SourceRow>('SELECT * FROM sources ORDER BY createdAt ASC');
  return rows.map(rowToSource);
}

export async function getSource(id: string): Promise<Source | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<SourceRow>('SELECT * FROM sources WHERE id = ?', id);
  return row ? rowToSource(row) : null;
}

type NewSourceInput =
  | { type: 'm3u_url'; name: string; url: string }
  | { type: 'm3u_file'; name: string; fileUri: string }
  | { type: 'xtream'; name: string; serverUrl: string; username: string; password: string }
  | { type: 'direct_stream'; name: string; url: string };

export async function createSource(input: NewSourceInput): Promise<Source> {
  const db = await getDatabase();
  const id = generateSourceId();
  const now = new Date().toISOString();
  const { type, name, ...rest } = input;

  await db.runAsync(
    `INSERT INTO sources (id, type, name, payload, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)`,
    id,
    type,
    name,
    JSON.stringify(rest),
    now,
    now
  );

  return { id, type, name, createdAt: now, updatedAt: now, ...rest } as Source;
}

export async function renameSource(id: string, name: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE sources SET name = ?, updatedAt = ? WHERE id = ?', name, new Date().toISOString(), id);
}

export async function deleteSource(id: string): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM channels WHERE sourceId = ?', id);
    await db.runAsync('DELETE FROM sources WHERE id = ?', id);
  });
}

export async function markSourceError(id: string, message: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE sources SET lastError = ?, updatedAt = ? WHERE id = ?', message, new Date().toISOString(), id);
}
