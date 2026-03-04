/**
 * TOKEN SERVICE
 * JWT token management and caching
 */

const { getRedis, setJson, getJson, deleteKey } = require('../../config/redis');
const authService = require('./authService');
const logger = require('../../utils/logger');

class TokenService {
  constructor() {
    this.redis = getRedis();
  }

  /**
   * Generate and cache access token
   */
  async generateAccessToken(userId, workspaceId, additionalClaims = {}) {
    const payload = {
      userId,
      workspaceId,
      type: 'access',
      ...additionalClaims
    };

    const token = authService.generateToken(payload, '15m');

    // Cache token for quick validation
    const cacheKey = `token:access:${userId}`;
    await setJson(cacheKey, {
      token,
      userId,
      workspaceId,
      createdAt: new Date().toISOString()
    }, 900); // 15 minutes

    logger.info('Access token generated', { userId, workspaceId });
    return token;
  }

  /**
   * Generate refresh token
   */
  async generateRefreshToken(userId, workspaceId) {
    const payload = {
      userId,
      workspaceId,
      type: 'refresh'
    };

    const token = authService.generateToken(payload, '30d');

    // Cache refresh token
    const cacheKey = `token:refresh:${userId}`;
    await setJson(cacheKey, {
      token,
      userId,
      workspaceId,
      createdAt: new Date().toISOString()
    }, 30 * 24 * 60 * 60); // 30 days

    logger.info('Refresh token generated', { userId, workspaceId });
    return token;
  }

  /**
   * Validate access token
   */
  async validateAccessToken(token) {
    try {
      const decoded = authService.verifyToken(token);

      if (decoded.type !== 'access') {
        throw new Error('Invalid token type');
      }

      // Check if token is cached (revoked tokens won't be)
      const cacheKey = `token:access:${decoded.userId}`;
      const cached = await getJson(cacheKey);

      if (!cached || cached.token !== token) {
        throw new Error('Token not found in cache');
      }

      return {
        userId: decoded.userId,
        workspaceId: decoded.workspaceId,
        ...decoded
      };
    } catch (error) {
      logger.warn('Access token validation failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken) {
    try {
      const decoded = authService.verifyToken(refreshToken);

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Verify refresh token is still valid in cache
      const cacheKey = `token:refresh:${decoded.userId}`;
      const cached = await getJson(cacheKey);

      if (!cached || cached.token !== refreshToken) {
        throw new Error('Refresh token not found or expired');
      }

      // Generate new access token
      const newAccessToken = await this.generateAccessToken(
        decoded.userId,
        decoded.workspaceId
      );

      logger.info('Access token refreshed', { userId: decoded.userId });
      return newAccessToken;
    } catch (error) {
      logger.warn('Token refresh failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Revoke all user tokens (logout)
   */
  async revokeUserTokens(userId) {
    try {
      const accessKey = `token:access:${userId}`;
      const refreshKey = `token:refresh:${userId}`;

      await Promise.all([
        deleteKey(accessKey),
        deleteKey(refreshKey)
      ]);

      logger.info('User tokens revoked', { userId });
    } catch (error) {
      logger.error('Failed to revoke user tokens', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Check if token is blacklisted
   */
  async isTokenBlacklisted(token) {
    try {
      const blacklistKey = 'token:blacklist';
      const blacklistedTokens = await getJson(blacklistKey) || [];

      return blacklistedTokens.includes(token);
    } catch (error) {
      logger.error('Failed to check token blacklist', { error: error.message });
      return false;
    }
  }

  /**
   * Blacklist a token (for immediate revocation)
   */
  async blacklistToken(token) {
    try {
      const blacklistKey = 'token:blacklist';
      const blacklistedTokens = await getJson(blacklistKey) || [];

      if (!blacklistedTokens.includes(token)) {
        blacklistedTokens.push(token);
        await setJson(blacklistKey, blacklistedTokens, 24 * 60 * 60); // 24 hours
      }

      logger.info('Token blacklisted');
    } catch (error) {
      logger.error('Failed to blacklist token', { error: error.message });
      throw error;
    }
  }
}

module.exports = new TokenService();