const crypto = require('crypto');

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 64;

// Get encryption key from env or generate one
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');

if (!process.env.ENCRYPTION_KEY) {
  console.warn('⚠️  WARNING: ENCRYPTION_KEY not set in .env - using random key (data will be lost on restart)');
  console.warn('⚠️  Add to .env: ENCRYPTION_KEY=' + ENCRYPTION_KEY);
}

/**
 * Derive a workspace-specific encryption key
 * @param {string} workspaceId - Workspace ID for key derivation
 * @returns {Buffer} - 32-byte key
 */
function deriveKey(workspaceId) {
  const salt = Buffer.from(workspaceId.toString().padEnd(SALT_LENGTH, '0').slice(0, SALT_LENGTH));
  return crypto.pbkdf2Sync(ENCRYPTION_KEY, salt, 100000, 32, 'sha512');
}

/**
 * Encrypt sensitive data (tokens, credentials)
 * @param {string} plaintext - Data to encrypt
 * @param {string} workspaceId - Workspace ID for key derivation
 * @returns {string} - Encrypted data in format: iv:authTag:encrypted
 */
function encrypt(plaintext, workspaceId) {
  if (!plaintext) return null;
  
  try {
    const key = deriveKey(workspaceId);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Return as: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption failed:', error.message);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt sensitive data
 * @param {string} encryptedData - Data in format: iv:authTag:encrypted
 * @param {string} workspaceId - Workspace ID for key derivation
 * @returns {string} - Decrypted plaintext
 */
function decrypt(encryptedData, workspaceId) {
  if (!encryptedData) return null;
  
  try {
    const key = deriveKey(workspaceId);
    const parts = encryptedData.split(':');
    
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error.message);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Check if data is encrypted (has our format)
 * @param {string} data - Data to check
 * @returns {boolean}
 */
function isEncrypted(data) {
  if (!data || typeof data !== 'string') return false;
  const parts = data.split(':');
  return parts.length === 3 && parts[0].length === IV_LENGTH * 2 && parts[1].length === AUTH_TAG_LENGTH * 2;
}

module.exports = {
  encrypt,
  decrypt,
  isEncrypted
};
