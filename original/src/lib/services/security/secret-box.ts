import crypto from 'crypto';
import { config } from '@/lib/config';

const ALGORITHM = 'aes-256-gcm';

function getKey() {
  return crypto.scryptSync(config.integrationEncryptionKey, 'wapi-integration-secrets', 32);
}

export function encryptSecret(value?: string | null) {
  if (!value) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecret(value?: string | null) {
  if (!value) return null;
  
  // Basic check: must have colons to be an encrypted secret
  if (!value.includes(':')) return value;

  const parts = value.split(':');
  
  // GCM format requires exactly 3 parts: [iv, tag, encrypted]
  if (parts.length !== 3) {
    return value;
  }

  try {
    const [ivHex, tagHex, encryptedHex] = parts;
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedHex, 'hex')),
      decipher.final()
    ]);
    return decrypted.toString('utf8');
  } catch (err) {
    // If decryption fails, it's likely a raw string that coincidentally had colons
    console.warn('[SecretBox] Decryption failed, returning raw value');
    return value;
  }
}

/**
 * AES-256-CBC Variants (Requested for specific provider compatibility)
 */
const CBC_ALGORITHM = 'aes-256-cbc';

export function encryptSecretCBC(value?: string | null) {
  if (!value) return null;
  const iv = crypto.randomBytes(16); // CBC uses 16-byte IV
  const cipher = crypto.createCipheriv(CBC_ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecretCBC(value?: string | null) {
  if (!value) return null;
  if (!value.includes(':')) return value;

  const parts = value.split(':');
  // CBC format: [iv, encrypted]
  if (parts.length !== 2) return value;

  try {
    const [ivHex, encryptedHex] = parts;
    const decipher = crypto.createDecipheriv(CBC_ALGORITHM, getKey(), Buffer.from(ivHex, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedHex, 'hex')),
      decipher.final()
    ]);
    return decrypted.toString('utf8');
  } catch (err) {
    console.warn('[SecretBox] CBC Decryption failed, returning raw');
    return value;
  }
}
