import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'auth.accessToken';
const EMAIL_KEY = 'auth.email';

/** JWT and account email — never stored in MMKV (product rule: secure token storage). */
export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY).catch(() => null);
}

export async function getStoredEmail(): Promise<string | null> {
  return SecureStore.getItemAsync(EMAIL_KEY).catch(() => null);
}

export async function saveSession(accessToken: string, email: string): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken),
    SecureStore.setItemAsync(EMAIL_KEY, email),
  ]);
}

export async function clearSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY).catch(() => undefined),
    SecureStore.deleteItemAsync(EMAIL_KEY).catch(() => undefined),
  ]);
}
