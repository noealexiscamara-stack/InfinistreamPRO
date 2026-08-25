import {
  readLockout,
  verifyParentalPin,
  writeLockout,
  writePinRecord,
  createParentalPinRecord,
} from '@/services/parental/parentalPin';

const store = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    store.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    store.delete(key);
  }),
}));

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn(async (_alg: string, input: string) => `hash(${input})`),
  getRandomBytesAsync: jest.fn(async (n: number) => Uint8Array.from({ length: n }, (_, i) => (i + 3) % 256)),
}));

describe('parental lockout persistence', () => {
  beforeEach(() => {
    store.clear();
    jest.clearAllMocks();
  });

  it('keeps lockout after simulated force-close (SecureStore survives)', async () => {
    const pinRecord = await createParentalPinRecord('9999');
    await writePinRecord(pinRecord);

    // Three wrong attempts → lockout written to SecureStore
    await verifyParentalPin('0000');
    await verifyParentalPin('0001');
    const third = await verifyParentalPin('0002');
    expect(third.ok).toBe(false);
    if (!third.ok) expect(third.reason).toBe('locked');

    const beforeRestart = await readLockout();
    expect(beforeRestart.lockedUntil).toBeGreaterThan(Date.now());
    expect(beforeRestart.lockoutSeries).toBe(1);

    // Simulate process death: in-memory Zustand is gone; SecureStore Map remains.
    const afterRestart = await readLockout();
    expect(afterRestart.lockedUntil).toBe(beforeRestart.lockedUntil);
    expect(afterRestart.lockoutSeries).toBe(1);

    const stillLocked = await verifyParentalPin('9999');
    expect(stillLocked.ok).toBe(false);
    if (!stillLocked.ok) expect(stillLocked.reason).toBe('locked');
  });

  it('persists mid-series failed attempt counts', async () => {
    const pinRecord = await createParentalPinRecord('4242');
    await writePinRecord(pinRecord);
    await writeLockout({ failedInSeries: 0, lockoutSeries: 0, lockedUntil: 0 });

    await verifyParentalPin('1111');
    const mid = await readLockout();
    expect(mid.failedInSeries).toBe(1);
    expect(mid.lockedUntil).toBe(0);

    // "Restart"
    const restored = await readLockout();
    expect(restored.failedInSeries).toBe(1);
  });
});
