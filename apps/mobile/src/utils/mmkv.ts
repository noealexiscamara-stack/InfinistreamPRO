import { MMKV } from 'react-native-mmkv';

/**
 * Fast key/value storage for small, frequently-read data: settings, quality
 * mode, last selected playlist, onboarding-complete flag, favorites/history
 * caches. Anything relational or potentially large (thousands of channels)
 * goes through SQLite instead (see ./sqlite.ts) — MMKV is not meant to hold
 * a whole parsed playlist in memory as a single blob.
 */
export const storage = new MMKV({ id: 'infiny-stream-kv' });

export function getJSON<T>(key: string, fallback: T): T {
  const raw = storage.getString(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function setJSON(key: string, value: unknown): void {
  storage.set(key, JSON.stringify(value));
}
