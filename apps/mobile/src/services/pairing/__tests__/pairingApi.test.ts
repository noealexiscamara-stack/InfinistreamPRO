import { formatPairingCode, pairingHintUrl, pairingPageUrl } from '../pairingUrls';

describe('pairingUrls', () => {
  it('formats a 6-char code with a mid dash', () => {
    expect(formatPairingCode('K7F92P')).toBe('K7F-92P');
  });

  it('builds the .pro pair URL, never .app', () => {
    expect(pairingPageUrl('K7F92P')).toBe('https://infinystream.pro/pair?code=K7F92P');
    expect(pairingHintUrl()).toBe('infinystream.pro/pair');
    expect(pairingPageUrl('K7F92P')).not.toContain('infinystream.app');
  });
});
