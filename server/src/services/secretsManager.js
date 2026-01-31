/**
 * Secure Token Storage Service
 * Replaces basic encryption with vault-ready architecture
 * Supports AWS Secrets Manager + local AES-256-GCM fallback
 */

const { encryptToken, decryptToken } = require('../utils/tokenEncryption');

/**
 * Store token securely
 * In production, integrates with AWS Secrets Manager
 * In dev, uses encrypted local storage
 */
async function storeToken(workspaceId, tokenType, tokenValue) {
  if (!tokenValue) {
    throw new Error('Token value required');
  }

  if (process.env.USE_AWS_SECRETS === 'true') {
    return storeInAWS(workspaceId, tokenType, tokenValue);
  }

  return storeLocallyEncrypted(workspaceId, tokenType, tokenValue);
}

/**
 * Store in AWS Secrets Manager
 */
async function storeInAWS(workspaceId, tokenType, tokenValue) {
  try {
    const { SecretsManagerClient, CreateSecretCommand, UpdateSecretCommand } = require('@aws-sdk/client-secrets-manager');
    const client = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });
    
    const secretId = `wapi/${process.env.NODE_ENV || 'dev'}/${workspaceId}/${tokenType}`;
    
    try {
      await client.send(new CreateSecretCommand({
        Name: secretId,
        SecretString: tokenValue,
        Tags: [
          { Key: 'workspace', Value: workspaceId },
          { Key: 'type', Value: tokenType },
          { Key: 'service', Value: 'whatsapp-api' }
        ]
      }));
      console.log(`[Secrets] ✅ Stored ${tokenType} in AWS for workspace ${workspaceId}`);
    } catch (err) {
      if (err.name === 'ResourceExistsException') {
        await client.send(new UpdateSecretCommand({
          SecretId: secretId,
          SecretString: tokenValue
        }));
        console.log(`[Secrets] ✅ Updated ${tokenType} in AWS for workspace ${workspaceId}`);
      } else {
        throw err;
      }
    }
    
    return {
      stored: true,
      location: 'aws',
      secretId: secretId,
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) // 60 days
    };
  } catch (err) {
    console.error('[Secrets] AWS storage failed, falling back to local:', err.message);
    return storeLocallyEncrypted(workspaceId, tokenType, tokenValue);
  }
}

/**
 * Store locally with AES-256-GCM encryption
 */
function storeLocallyEncrypted(workspaceId, tokenType, tokenValue) {
  try {
    const encryptedValue = encryptToken(tokenValue, workspaceId);

    console.log(`[Secrets] 🔐 Stored ${tokenType} locally (encrypted) for workspace ${workspaceId}`);
    
    return {
      stored: true,
      location: 'local',
      encryptedValue,
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
    };
  } catch (err) {
    console.error('[Secrets] Local encryption failed:', err.message);
    throw err;
  }
}

/**
 * Retrieve token securely
 */
async function retrieveToken(workspaceId, tokenType, encryptedValue = null) {
  if (process.env.USE_AWS_SECRETS === 'true') {
    return retrieveFromAWS(workspaceId, tokenType);
  }

  if (!encryptedValue) {
    throw new Error('Encrypted value required for local retrieval');
  }

  return retrieveLocallyEncrypted(encryptedValue, workspaceId);
}

/**
 * Retrieve from AWS Secrets Manager
 */
async function retrieveFromAWS(workspaceId, tokenType) {
  try {
    const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
    const client = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });
    
    const secretId = `wapi/${process.env.NODE_ENV || 'dev'}/${workspaceId}/${tokenType}`;
    
    const response = await client.send(new GetSecretValueCommand({
      SecretId: secretId
    }));
    
    return response.SecretString;
  } catch (err) {
    if (err.name === 'ResourceNotFoundException') {
      console.warn(`[Secrets] Token not found in AWS: ${tokenType} for ${workspaceId}`);
      return null;
    }
    throw err;
  }
}

/**
 * Retrieve locally encrypted token
 */
function retrieveLocallyEncrypted(encryptedValue, workspaceId) {
  try {
    return decryptToken(encryptedValue, workspaceId);
  } catch (err) {
    console.error('[Secrets] Decryption failed:', err.message);
    throw err;
  }
}

/**
 * Delete token from storage
 */
async function deleteToken(workspaceId, tokenType) {
  if (process.env.USE_AWS_SECRETS === 'true') {
    try {
      const { SecretsManagerClient, DeleteSecretCommand } = require('@aws-sdk/client-secrets-manager');
      const client = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });
      
      const secretId = `wapi/${process.env.NODE_ENV || 'dev'}/${workspaceId}/${tokenType}`;
      
      await client.send(new DeleteSecretCommand({
        SecretId: secretId,
        ForceDeleteWithoutRecovery: false,
        RecoveryWindowInDays: 7
      }));
      
      console.log(`[Secrets] ✅ Deleted ${tokenType} from AWS for workspace ${workspaceId}`);
    } catch (err) {
      console.error('[Secrets] AWS delete failed:', err.message);
    }
  }
}

/**
 * Store refresh token (used by tokenRefreshCron)
 */
async function storeRefreshToken(workspaceId, refreshToken) {
  return storeToken(workspaceId, 'refresh_token', refreshToken);
}

/**
 * Retrieve refresh token (used by tokenRefreshCron)
 */
async function retrieveRefreshToken(workspaceId) {
  return retrieveToken(workspaceId, 'refresh_token');
}

module.exports = {
  storeToken,
  retrieveToken,
  deleteToken,
  storeRefreshToken,
  retrieveRefreshToken
};
