import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

/**
 * Parental PIN — never stored in cleartext.
 * Persist only { salt, hash } in expo-secure-store (not MMKV / AsyncStorage).
 */
const PIN_KEY = 'infiny.parental.pin.v1';
const LOCKOUT_KEY = 'infiny.parental.lockout.v1';

const BASE_LOCKOUT_MS = 60_000;
const MAX_ATTEMPTS_PER_SERIES = 3;

export interface ParentalPinRecord {
  /** Hex salt. */
  salt: string;
  /** Hex SHA-256(salt || pin). */
  hash: string;
}

export interface ParentalLockoutRecord {
  /** Failed attempts in the current series (0..3). */
  failedInSeries: number;
  /** How many lockout series have completed (doubles duration). */
  lockoutSeries: number;
  /** Epoch ms until which unlock is blocked (0 = not locked). */
  lockedUntil: number;
}

async function sha256Hex(input: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashParentalPin(pin: string, saltHex: string): Promise<string> {
  return sha256Hex(`${saltHex}:${pin}`);
}

export async function createParentalPinRecord(pin: string): Promise<ParentalPinRecord> {
  const saltBytes = await Crypto.getRandomBytesAsync(16);
  const salt = bytesToHex(saltBytes);
  const hash = await hashParentalPin(pin, salt);
  return { salt, hash };
}

export function isValidPinFormat(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

export async function readPinRecord(): Promise<ParentalPinRecord | null> {
  const raw = await SecureStore.getItemAsync(PIN_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ParentalPinRecord;
    if (!parsed?.salt || !parsed?.hash) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writePinRecord(record: ParentalPinRecord): Promise<void> {
  // Stored hashed — never the cleartext PIN.
  await SecureStore.setItemAsync(PIN_KEY, JSON.stringify(record));
}

export async function hasParentalPin(): Promise<boolean> {
  return (await readPinRecord()) != null;
}

export async function setParentalPin(pin: string): Promise<void> {
  if (!isValidPinFormat(pin)) throw new Error('Le code doit contenir 4 chiffres.');
  const record = await createParentalPinRecord(pin);
  await writePinRecord(record);
  await writeLockout({ failedInSeries: 0, lockoutSeries: 0, lockedUntil: 0 });
}

export async function clearParentalPin(): Promise<void> {
  await SecureStore.deleteItemAsync(PIN_KEY);
  await SecureStore.deleteItemAsync(LOCKOUT_KEY);
}

export async function readLockout(): Promise<ParentalLockoutRecord> {
  const raw = await SecureStore.getItemAsync(LOCKOUT_KEY);
  if (!raw) return { failedInSeries: 0, lockoutSeries: 0, lockedUntil: 0 };
  try {
    return JSON.parse(raw) as ParentalLockoutRecord;
  } catch {
    return { failedInSeries: 0, lockoutSeries: 0, lockedUntil: 0 };
  }
}

export async function writeLockout(record: ParentalLockoutRecord): Promise<void> {
  await SecureStore.setItemAsync(LOCKOUT_KEY, JSON.stringify(record));
}

export function lockoutRemainingMs(lockout: ParentalLockoutRecord, now = Date.now()): number {
  return Math.max(0, lockout.lockedUntil - now);
}

export function currentLockoutDurationMs(lockoutSeries: number): number {
  // Series 1 → 60s, series 2 → 120s, series 3 → 240s, …
  const series = Math.max(1, lockoutSeries);
  return BASE_LOCKOUT_MS * 2 ** (series - 1);
}

export type VerifyPinResult =
  | { ok: true }
  | { ok: false; reason: 'no_pin' | 'invalid_format' | 'locked' | 'wrong'; lockedMs?: number; attemptsLeft?: number };

export async function verifyParentalPin(pin: string): Promise<VerifyPinResult> {
  const lockout = await readLockout();
  const remaining = lockoutRemainingMs(lockout);
  if (remaining > 0) {
    return { ok: false, reason: 'locked', lockedMs: remaining };
  }

  if (!isValidPinFormat(pin)) {
    return { ok: false, reason: 'invalid_format' };
  }

  const record = await readPinRecord();
  if (!record) return { ok: false, reason: 'no_pin' };

  const candidate = await hashParentalPin(pin, record.salt);
  if (candidate === record.hash) {
    await writeLockout({ failedInSeries: 0, lockoutSeries: 0, lockedUntil: 0 });
    return { ok: true };
  }

  const failedInSeries = lockout.failedInSeries + 1;
  if (failedInSeries >= MAX_ATTEMPTS_PER_SERIES) {
    const lockoutSeries = lockout.lockoutSeries + 1;
    const duration = currentLockoutDurationMs(lockoutSeries);
    await writeLockout({
      failedInSeries: 0,
      lockoutSeries,
      lockedUntil: Date.now() + duration,
    });
    return { ok: false, reason: 'locked', lockedMs: duration };
  }

  await writeLockout({
    failedInSeries,
    lockoutSeries: lockout.lockoutSeries,
    lockedUntil: 0,
  });
  return {
    ok: false,
    reason: 'wrong',
    attemptsLeft: MAX_ATTEMPTS_PER_SERIES - failedInSeries,
  };
}
