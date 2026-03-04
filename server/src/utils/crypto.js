/**
 * CRYPTO UTILITIES
 * Encryption and decryption utilities for sensitive data
 */

const crypto = require('crypto');

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const TAG_LENGTH = 16; // 128 bits

// Get encryption key from environment or generate one
function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }

  // Ensure key is the correct length
  if (Buffer.from(key, 'hex').length !== KEY_LENGTH) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (256 bits)');
  }

  return Buffer.from(key, 'hex');
}

/**
 * Encrypt sensitive data
 */
function encrypt(text) {
  if (!text) return null;

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipher(ALGORITHM, key);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const tag = cipher.getAuthTag();

  // Return format: iv:encrypted:tag
  return iv.toString('hex') + ':' + encrypted + ':' + tag.toString('hex');
}

/**
 * Decrypt sensitive data
 */
function decrypt(encryptedText) {
  if (!encryptedText) return null;

  try {
    const key = getEncryptionKey();
    const parts = encryptedText.split(':');

    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const tag = Buffer.from(parts[2], 'hex');

    const decipher = crypto.createDecipher(ALGORITHM, key);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    throw new Error('Failed to decrypt data: ' + error.message);
  }
}

/**
 * Hash sensitive data (one-way)
 */
function hash(text, saltRounds = 12) {
  if (!text) return null;

  // Use bcrypt for password hashing
  const bcrypt = require('bcryptjs');
  return bcrypt.hash(text, saltRounds);
}

/**
 * Verify hashed data
 */
function verifyHash(text, hashedText) {
  if (!text || !hashedText) return false;

  const bcrypt = require('bcryptjs');
  return bcrypt.compare(text, hashedText);
}

/**
 * Generate secure random token
 */
function generateToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate secure random string (URL-safe)
 */
function generateSecureString(length = 32) {
  const bytes = crypto.randomBytes(length);
  return bytes.toString('base64url');
}

/**
 * Hash API key for storage (one-way)
 */
function hashApiKey(apiKey) {
  if (!apiKey) return null;

  const salt = process.env.API_KEY_SALT || 'default-salt-change-in-production';
  return crypto.createHash('sha256').update(apiKey + salt).digest('hex');
}

/**
 * Verify API key against hash
 */
function verifyApiKey(apiKey, hashedApiKey) {
  if (!apiKey || !hashedApiKey) return false;

  const computedHash = hashApiKey(apiKey);
  return crypto.timingSafeEqual(
    Buffer.from(computedHash, 'hex'),
    Buffer.from(hashedApiKey, 'hex')
  );
}

/**
 * Encrypt object properties
 */
function encryptObject(obj, propertiesToEncrypt) {
  if (!obj || typeof obj !== 'object') return obj;

  const encrypted = { ...obj };

  propertiesToEncrypt.forEach(prop => {
    if (encrypted[prop] !== undefined) {
      encrypted[prop] = encrypt(String(encrypted[prop]));
    }
  });

  return encrypted;
}

/**
 * Decrypt object properties
 */
function decryptObject(obj, propertiesToDecrypt) {
  if (!obj || typeof obj !== 'object') return obj;

  const decrypted = { ...obj };

  propertiesToDecrypt.forEach(prop => {
    if (decrypted[prop] !== undefined) {
      try {
        decrypted[prop] = decrypt(String(decrypted[prop]));
      } catch (error) {
        // If decryption fails, keep the original value
        console.warn(`Failed to decrypt property ${prop}:`, error.message);
      }
    }
  });

  return decrypted;
}

module.exports = {
  encrypt,
  decrypt,
  hash,
  verifyHash,
  generateToken,
  generateSecureString,
  hashApiKey,
  verifyApiKey,
  encryptObject,
  decryptObject
};