import {
  createParentalPinRecord,
  hashParentalPin,
  isValidPinFormat,
  writePinRecord,
  type ParentalPinRecord,
} from '@/services/parental/parentalPin';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn(async (_alg: string, input: string) => `hash(${input})`),
  getRandomBytesAsync: jest.fn(async (n: number) => Uint8Array.from({ length: n }, (_, i) => i + 1)),
}));

describe('parentalPin hashing', () => {
  it('never stores a cleartext PIN — only salt + hash', async () => {
    const record: ParentalPinRecord = await createParentalPinRecord('1234');
    expect(record.salt).toMatch(/^[0-9a-f]+$/);
    expect(record.hash).toBe(await hashParentalPin('1234', record.salt));
    expect(record.hash).not.toBe('1234');
    expect(Object.keys(record).sort()).toEqual(['hash', 'salt']);

    const SecureStore = require('expo-secure-store') as {
      setItemAsync: jest.Mock;
    };
    await writePinRecord(record);
    const stored = JSON.parse(SecureStore.setItemAsync.mock.calls[0][1] as string) as ParentalPinRecord;
    expect(stored).toEqual(record);
    expect(stored).not.toHaveProperty('pin');
  });

  it('accepts only 4-digit PINs', () => {
    expect(isValidPinFormat('1234')).toBe(true);
    expect(isValidPinFormat('12')).toBe(false);
    expect(isValidPinFormat('abcd')).toBe(false);
  });
});
