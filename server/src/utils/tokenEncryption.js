/**
 * =============================================================================
 * TOKEN ENCRYPTION UTILITY - INTERAKT BSP SECURITY
 * =============================================================================
 * 
 * Secure token encryption/decryption for BSP platform.
 * - AES-256-GCM encryption at rest
 * - Never expose raw tokens outside service layer
 * - Token health check and validation
 * - Detect expired/revoked tokens
 * 
 * SECURITY PRINCIPLES:
 * 1. Tokens encrypted before DB storage
 * 2. Decryption only in service layer (not controllers)
 * 3. Master key from environment, never hardcoded
 * 4. Auth tags prevent tampering
 */

const crypto = require('crypto');

// =============================================================================
// CONFIGURATION
// =============================================================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

// =============================================================================
// ENCRYPTION KEY VERSIONING (Task B)
// =============================================================================

// Current version for new encryptions
const CURRENT_KEY_VERSION = 'v2';

// Supported encryption versions (for key rotation)
// Add new versions here when rotating keys
const ENCRYPTION_KEYS = {
  v1: process.env.TOKEN_ENCRYPTION_KEY_V1
    ? Buffer.from(process.env.TOKEN_ENCRYPTION_KEY_V1, 'hex')
    : null,
  v2: process.env.TOKEN_ENCRYPTION_KEY
    ? Buffer.from(process.env.TOKEN_ENCRYPTION_KEY, 'hex')
    : null
};

// Master encryption key - MUST be set in production (uses current version)
const MASTER_KEY = ENCRYPTION_KEYS[CURRENT_KEY_VERSION];

// Fallback for development (generates ephemeral key - tokens won't persist across restarts)
let DEV_KEY = null;
function getDevKey() {
  if (!DEV_KEY) {
    DEV_KEY = crypto.randomBytes(32);
    console.warn('[TokenEncryption] ⚠️ Using ephemeral dev key - set TOKEN_ENCRYPTION_KEY in production');
  }
  return DEV_KEY;
}

function getEncryptionKey(version = CURRENT_KEY_VERSION) {
  // Get key for specific version (for decryption of old tokens)
  const versionedKey = ENCRYPTION_KEYS[version];
  if (versionedKey) return versionedKey;
  
  // Fallback to master key
  if (MASTER_KEY) return MASTER_KEY;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('TOKEN_ENCRYPTION_KEY must be set in production');
  }
  return getDevKey();
}

/**
 * Get encryption key version from encrypted token
 * @param {string} encryptedToken - Encrypted token string
 * @returns {string|null} - Version string (v1, v2) or null
 */
function getEncryptionVersion(encryptedToken) {
  if (!encryptedToken || typeof encryptedToken !== 'string') return null;
  const parts = encryptedToken.split(':');
  if (parts.length >= 2 && parts[0] === 'enc') {
    return parts[1]; // v1, v2, etc.
  }
  return null;
}

// =============================================================================
// ENCRYPTION
// =============================================================================

/**
 * Encrypt a token for storage
 * @param {string} token - Plain token to encrypt
 * @param {string} context - Workspace ID or context for key derivation
 * @returns {string} - Encrypted token (base64 encoded with IV and auth tag)
 */
function encryptToken(token, context = '') {
  if (!token) {
    throw new Error('Token value required for encryption');
  }

  try {
    const key = getEncryptionKey();
    
    // Generate random IV for each encryption
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Optional: derive a context-specific key using HKDF
    const derivedKey = crypto.createHmac('sha256', key)
      .update(context || 'default')
      .digest();
    
    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);
    
    // Encrypt
    let encrypted = cipher.update(token, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    // Get auth tag for tamper detection
    const authTag = cipher.getAuthTag();
    
    // Combine IV + authTag + encrypted data
    // Format: enc:version:base64(iv):base64(authTag):base64(encryptedData)
    const result = `enc:${CURRENT_KEY_VERSION}:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
    
    return result;
  } catch (error) {
    console.error('[TokenEncryption] Encryption failed:', error.message);
    throw new Error('Token encryption failed');
  }
}

// =============================================================================
// DECRYPTION
// =============================================================================

/**
 * Decrypt a stored token
 * @param {string} encryptedToken - Encrypted token string
 * @param {string} context - Workspace ID or context for key derivation
 * @returns {string} - Decrypted plain token
 */
function decryptToken(encryptedToken, context = '') {
  if (!encryptedToken) {
    throw new Error('Encrypted token required for decryption');
  }

  // Check if token is actually encrypted
  if (!isEncrypted(encryptedToken)) {
    console.warn('[TokenEncryption] Token is not encrypted, returning as-is');
    return encryptedToken;
  }

  try {
    // Parse encrypted format
    const parts = encryptedToken.split(':');
    if (parts.length !== 5 || parts[0] !== 'enc') {
      throw new Error('Invalid encrypted token format');
    }
    
    const version = parts[1]; // v1, v2, etc.
    const iv = Buffer.from(parts[2], 'base64');
    const authTag = Buffer.from(parts[3], 'base64');
    const encrypted = parts[4];
    
    // Get key for the version this token was encrypted with
    const key = getEncryptionKey(version);
    if (!key) {
      throw new Error(`No encryption key found for version ${version}`);
    }
    
    // Derive context-specific key
    const derivedKey = crypto.createHmac('sha256', key)
      .update(context || 'default')
      .digest();
    
    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
    decipher.setAuthTag(authTag);
    
    // Decrypt
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('[TokenEncryption] Decryption failed:', error.message);
    throw new Error('Token decryption failed - token may be corrupted or tampered');
  }
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Check if a value is encrypted
 * @param {string} value - Value to check
 * @returns {boolean} - True if encrypted
 */
function isEncrypted(value) {
  if (!value || typeof value !== 'string') return false;
  // Support any version: enc:v1:, enc:v2:, etc.
  return /^enc:v\d+:/.test(value);
}

/**
 * Check if token needs re-encryption with current key version
 * @param {string} encryptedToken - Encrypted token
 * @returns {boolean} - True if token uses old version
 */
function needsReEncryption(encryptedToken) {
  const version = getEncryptionVersion(encryptedToken);
  return version && version !== CURRENT_KEY_VERSION;
}

/**
 * Re-encrypt token with current key version (for key rotation)
 * @param {string} encryptedToken - Token encrypted with old version
 * @param {string} context - Workspace context
 * @returns {string} - Token encrypted with current version
 */
function reEncryptToken(encryptedToken, context = '') {
  if (!needsReEncryption(encryptedToken)) {
    return encryptedToken; // Already using current version
  }
  
  // Decrypt with old key, re-encrypt with new key
  const plainToken = decryptToken(encryptedToken, context);
  return encryptToken(plainToken, context);
}

/**
 * Safely get a token (decrypt if needed)
 * @param {string} tokenValue - Token that may or may not be encrypted
 * @param {string} context - Workspace context
 * @returns {string|null} - Decrypted token or null on error
 */
function safeDecrypt(tokenValue, context = '') {
  try {
    if (!tokenValue) return null;
    if (isEncrypted(tokenValue)) {
      return decryptToken(tokenValue, context);
    }
    return tokenValue;
  } catch (error) {
    console.error('[TokenEncryption] Safe decrypt failed:', error.message);
    return null;
  }
}

/**
 * Hash a token for logging (never log raw tokens)
 * @param {string} token - Token to hash
 * @returns {string} - First 8 chars of SHA256 hash
 */
function hashForLog(token) {
  if (!token) return 'null';
  return crypto.createHash('sha256').update(token).digest('hex').substring(0, 8);
}

// =============================================================================
// TOKEN HEALTH CHECKS
// =============================================================================

/**
 * Validate token health status
 * @param {string} token - Access token to validate
 * @returns {Promise<Object>} - Token health status
 */
async function checkTokenHealth(token) {
  const axios = require('axios');
  const META_API_VERSION = process.env.META_API_VERSION || 'v21.0';
  
  if (!token) {
    return {
      valid: false,
      error: 'NO_TOKEN',
      message: 'Token is missing'
    };
  }

  try {
    // Debug token to check validity
    const response = await axios.get(
      `https://graph.facebook.com/${META_API_VERSION}/debug_token`,
      {
        params: {
          input_token: token,
          access_token: `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`
        },
        timeout: 10000
      }
    );

    const data = response.data.data;
    
    // Check if token is valid
    if (!data.is_valid) {
      return {
        valid: false,
        error: data.error?.code || 'INVALID_TOKEN',
        message: data.error?.message || 'Token is invalid',
        expiresAt: null
      };
    }

    // Check expiration
    const expiresAt = data.expires_at ? new Date(data.expires_at * 1000) : null;
    const isExpired = expiresAt && expiresAt < new Date();
    const isExpiringSoon = expiresAt && 
      expiresAt < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Extract permissions
    const scopes = data.scopes || [];
    const hasMessaging = scopes.includes('whatsapp_business_messaging');
    const hasManagement = scopes.includes('whatsapp_business_management');

    return {
      valid: !isExpired,
      expired: isExpired,
      expiringSoon: isExpiringSoon,
      expiresAt,
      scopes,
      hasRequiredScopes: hasMessaging && hasManagement,
      appId: data.app_id,
      userId: data.user_id,
      type: data.type,
      granularScopes: data.granular_scopes || []
    };
  } catch (error) {
    // Handle specific Meta API errors
    const metaError = error.response?.data?.error;
    
    if (metaError) {
      return {
        valid: false,
        error: metaError.code || 'META_API_ERROR',
        message: metaError.message || 'Token validation failed',
        subcode: metaError.error_subcode
      };
    }

    return {
      valid: false,
      error: 'NETWORK_ERROR',
      message: error.message
    };
  }
}

/**
 * Check if token has required WhatsApp scopes
 * @param {Object} healthResult - Result from checkTokenHealth
 * @returns {boolean} - True if all required scopes present
 */
function hasRequiredScopes(healthResult) {
  if (!healthResult?.valid) return false;
  return healthResult.hasRequiredScopes === true;
}

/**
 * Detect if token was revoked
 * @param {Object} healthResult - Result from checkTokenHealth
 * @returns {boolean} - True if token appears revoked
 */
function isTokenRevoked(healthResult) {
  if (!healthResult) return true;
  
  const revokedCodes = [190, 102, 463, 467];
  return !healthResult.valid && revokedCodes.includes(healthResult.error);
}

// =============================================================================
// MIGRATION HELPER
// =============================================================================

/**
 * Migrate unencrypted tokens to encrypted format
 * @param {Object} workspace - Workspace document
 * @returns {Object} - Updated fields for workspace
 */
function migrateTokens(workspace) {
  const updates = {};
  const workspaceId = workspace._id?.toString() || 'default';

  // Migrate accessToken
  if (workspace.accessToken && !isEncrypted(workspace.accessToken)) {
    updates.accessToken = encryptToken(workspace.accessToken, workspaceId);
    console.log(`[TokenMigration] Encrypted accessToken for workspace ${workspaceId}`);
  }

  // Migrate ESB tokens
  if (workspace.esbFlow?.userAccessToken && !isEncrypted(workspace.esbFlow.userAccessToken)) {
    updates['esbFlow.userAccessToken'] = encryptToken(workspace.esbFlow.userAccessToken, workspaceId);
    console.log(`[TokenMigration] Encrypted ESB userAccessToken for workspace ${workspaceId}`);
  }

  if (workspace.esbFlow?.userRefreshToken && !isEncrypted(workspace.esbFlow.userRefreshToken)) {
    updates['esbFlow.userRefreshToken'] = encryptToken(workspace.esbFlow.userRefreshToken, workspaceId);
    console.log(`[TokenMigration] Encrypted ESB userRefreshToken for workspace ${workspaceId}`);
  }

  if (workspace.esbFlow?.systemUserToken && !isEncrypted(workspace.esbFlow.systemUserToken)) {
    updates['esbFlow.systemUserToken'] = encryptToken(workspace.esbFlow.systemUserToken, workspaceId);
    console.log(`[TokenMigration] Encrypted ESB systemUserToken for workspace ${workspaceId}`);
  }

  return updates;
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  encryptToken,
  decryptToken,
  isEncrypted,
  safeDecrypt,
  hashForLog,
  checkTokenHealth,
  hasRequiredScopes,
  isTokenRevoked,
  migrateTokens,
  // Key versioning exports
  getEncryptionVersion,
  needsReEncryption,
  reEncryptToken,
  CURRENT_KEY_VERSION
};
