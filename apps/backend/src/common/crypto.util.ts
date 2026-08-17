import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

/**
 * AES-256-GCM helper for at-rest encryption of sensitive playlist
 * credentials (Xtream passwords — product rule #46: never store IPTV
 * passwords in clear text). This is a pragmatic MVP implementation: the
 * key is derived from a single environment secret via scrypt. Production
 * hardening (out of scope here, see docs/LIMITATIONS.md) should move key
 * management to a proper KMS/secrets manager with rotation support.
 */
const ALGORITHM = 'aes-256-gcm';

function deriveKey(secret: string): Buffer {
  return scryptSync(secret, 'infiny-stream-static-salt', 32);
}

export function encryptSecret(plainText: string, secret: string): string {
  const key = deriveKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join('.');
}

export function decryptSecret(payload: string, secret: string): string {
  const [ivB64, authTagB64, dataB64] = payload.split('.');
  const key = deriveKey(secret);
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
  return decrypted.toString('utf8');
}
