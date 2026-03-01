const axios = require('axios');
const bspConfig = require('../config/bspConfig');
const { getRedis } = require('../config/redis');
const { logger } = require('../utils/logger');

const TOKEN_KEY = 'gupshup:partner_token';
const TOKEN_TTL_SECONDS = 82800; // 23 hours in seconds (Gupshup token expires in 24 hours)

let memoryToken = null;
let memoryTokenExpiry = null;
let refreshPromise = null;

/**
 * Perform login to fetch a new partner token
 */
async function fetchNewToken() {
  const email = process.env.GUPSHUP_PARTNER_EMAIL;
  const clientSecret = process.env.GUPSHUP_PARTNER_CLIENT_SECRET;

  if (!email || !clientSecret) {
    throw new Error('GUPSHUP_PARTNER_LOGIN_CREDENTIALS_MISSING');
  }

  const body = new URLSearchParams();
  body.set('email', email);
  body.set('password', clientSecret);

  const url = `${bspConfig.partnerBaseUrl}/partner/account/login`;
  
  try {
    logger.info('Attempting to fetch new Gupshup partner token via login...');
    const response = await axios.post(url, body.toString(), {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 15000
    });

    const token = response.data?.token;
    if (!token) {
      throw new Error('No token returned from Gupshup API.');
    }
    
    // Clean Bearer prefix if it exists just to be safe
    const cleanToken = String(token).replace(/^Bearer\s+/i, '').trim();
    logger.info('Successfully generated and retrieved new Gupshup partner token.');
    return cleanToken;
  } catch (error) {
    logger.error('Failed to fetch Gupshup partner token', error?.response?.data || error.message);
    throw new Error('GUPSHUP_PARTNER_TOKEN_LOGIN_FAILED');
  }
}

/**
 * Gets a valid Partner Token, utilizing Redis (session-cache) when available.
 * Automatically refreshes if missing or expired.
 */
async function getPartnerToken(forceRefresh = false) {
  let redisClient = null;
  try {
    // getRedis throws if SKIP_REDIS=true or client is not initialized
    redisClient = getRedis();
  } catch (err) {
    // Using in-memory fallback
  }

  if (!forceRefresh) {
    if (redisClient) {
      try {
        const cached = await redisClient.get(TOKEN_KEY);
        if (cached) {
          return cached;
        }
      } catch (redisErr) {
        logger.error('Redis error while getting partner token, falling back to memory', redisErr.message);
      }
    }

    if (memoryToken && memoryTokenExpiry && Date.now() < memoryTokenExpiry) {
      return memoryToken;
    }
  }

  // Deduplicate inflight refresh requests
  if (refreshPromise) {
    return refreshPromise;
  }

  // Generate new token & persist it
  refreshPromise = fetchNewToken()
    .then(async (token) => {
      // 1. Store in Redis
      if (redisClient) {
        try {
          await redisClient.set(TOKEN_KEY, token, { EX: TOKEN_TTL_SECONDS });
          logger.info('Saved new Gupshup partner token to Redis session storage.');
        } catch (redisErr) {
          logger.error('Failed to save partner token to Redis', redisErr.message);
        }
      }

      // 2. Store in Memory directly as fallback
      memoryToken = token;
      memoryTokenExpiry = Date.now() + (TOKEN_TTL_SECONDS * 1000);
      
      return token;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

module.exports = {
  getPartnerToken,
  fetchNewToken,
  TOKEN_KEY
};
