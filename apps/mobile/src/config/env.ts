/** Backend base URL — set via EXPO_PUBLIC_API_URL (never hardcode in call sites). */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');

export function requireApiUrl(): string {
  if (!API_URL) {
    throw new Error('EXPO_PUBLIC_API_URL is not configured.');
  }
  return API_URL;
}
