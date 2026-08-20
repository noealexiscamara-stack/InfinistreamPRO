export const PAIRING_WEB_ORIGIN = 'https://infinystream.pro';
export const PAIRING_PATH = '/pair';

/** User-facing code with a mid dash (ABC123 → ABC-123). */
export function formatPairingCode(code: string): string {
  const clean = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (clean.length <= 3) return clean;
  return `${clean.slice(0, 3)}-${clean.slice(3)}`;
}

/** QR / deep-link target for the phone approval page. */
export function pairingPageUrl(code: string): string {
  const clean = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return `${PAIRING_WEB_ORIGIN}${PAIRING_PATH}?code=${encodeURIComponent(clean)}`;
}

export function pairingHintUrl(): string {
  return `${PAIRING_WEB_ORIGIN.replace(/^https?:\/\//, '')}${PAIRING_PATH}`;
}
