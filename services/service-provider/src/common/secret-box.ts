import * as crypto from 'crypto';
import { config } from '../config';

const ALGORITHM = 'aes-256-gcm';
const CBC_ALGORITHM = 'aes-256-cbc';

function getKey(): Buffer {
  const baseKey = config.integrationEncryptionKey;
  return crypto.scryptSync(baseKey, 'connectsphere-integration-secrets', 32);
}

export function encryptSecret(value?: string | null): string | null {
  if (!value) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecret(value?: string | null): string | null {
  if (!value) return null;
  
  if (!value.includes(':')) return value;

  const parts = value.split(':');
  
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
    console.warn('[SecretBox] Decryption failed, returning raw value');
    return value;
  }
}

export function encryptSecretCBC(value?: string | null): string | null {
  if (!value) return null;
  const iv = crypto.randomBytes(16); // CBC uses 16-byte IV
  const cipher = crypto.createCipheriv(CBC_ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecretCBC(value?: string | null): string | null {
  if (!value) return null;
  if (!value.includes(':')) return value;

  const parts = value.split(':');
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
