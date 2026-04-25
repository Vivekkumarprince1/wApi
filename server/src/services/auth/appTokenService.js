const axios = require('axios');
const { User, Workspace } = require('../../models');
const { getPartnerToken } = require('../bsp/partnerTokenService');
const { getRedis } = require('../../config/redis');
const logger = require('../../utils/logger');

// The partner API to fetch app access tokens
const GUPSHUP_PARTNER_APP_TOKEN_URL = 'https://partner.gupshup.io/partner/app';

function normalizeRawToken(token) {
    return String(token || '').replace(/^Bearer\s+/i, '').trim();
}

function extractTokenFromResponse(data) {
    const candidates = [
        data?.token,
        data?.accessToken,
        data?.access_token,
        data?.data?.token,
        data?.data?.accessToken,
        data?.data?.access_token,
        data?.result?.token,
        data?.result?.accessToken,
        data?.result?.access_token
    ];

    const pickStringToken = (value) => {
        if (!value) return '';
        if (typeof value === 'string') return normalizeRawToken(value);
        if (typeof value === 'object') {
            return (
                normalizeRawToken(value.token) ||
                normalizeRawToken(value.accessToken) ||
                normalizeRawToken(value.access_token) ||
                normalizeRawToken(value.value) ||
                ''
            );
        }
        return '';
    };

    for (const candidate of candidates) {
        const token = pickStringToken(candidate);
        if (token && token !== '[object Object]') {
            return token;
        }
    }

    return '';
}

/**
 * Generate an App Access Token by exchanging Partner Token and App ID
 * @param {string} appId - The Gupshup App ID
 * @returns {Promise<string>} - The temporary App Access Token
 */
async function generateAppAccessToken(appId) {
    if (!appId) throw new Error('App ID is required for token generation');
    
    // 1. Check Redis Cache
    const redisClient = getRedis();
    if (redisClient) {
        const cachedToken = await redisClient.get(`gupshup:app_token:${appId}`);
        if (cachedToken) {
            logger.info(`[AppTokenService] Found cached app token for appId: ${appId}`);
            return cachedToken;
        }
    }

    try {
        // 2. Get Partner Token from Session/Cache
        const partnerToken = await getPartnerToken();
        if (!partnerToken) {
            throw new Error('Could not retrieve Partner Token');
        }

        const normalizedPartnerToken = normalizeRawToken(partnerToken);

        logger.info(`[AppTokenService] Exchanging Partner Token for App Access Token. AppId: ${appId}`);

        // 3. Make HTTP request to Gupshup Partner API (try known auth header variants)
        const url = `${GUPSHUP_PARTNER_APP_TOKEN_URL}/${appId}/token`;
        const headerVariants = [
            { Authorization: normalizedPartnerToken, token: normalizedPartnerToken, Accept: 'application/json' },
            { Authorization: `Bearer ${normalizedPartnerToken}`, token: normalizedPartnerToken, Accept: 'application/json' },
            { token: normalizedPartnerToken, Accept: 'application/json' }
        ];

        let appAccessToken = '';
        let lastError = null;

        for (const headers of headerVariants) {
            try {
                const response = await axios.get(url, { headers, timeout: 15000 });
                appAccessToken = extractTokenFromResponse(response.data);
                if (appAccessToken) break;
            } catch (error) {
                lastError = error;
                const status = Number(error?.response?.status || 0);
                if (status !== 401 && status !== 403) {
                    throw error;
                }
            }
        }
        
        if (!appAccessToken) {
            if (lastError?.response) {
                throw new Error(`Gupshup Token API Error: ${lastError.response.status} - ${JSON.stringify(lastError.response.data)}`);
            }
            throw new Error('Received malformed response from Gupshup API - no token found');
        }

        logger.info(`[AppTokenService] Successfully generated App Access Token for appId: ${appId}`);

        // 4. Cache the new app token in Redis
        // App Access Tokens typically last for 24 hours. We cache for 23 hours to be safe.
        if (redisClient) {
            await redisClient.set(
                `gupshup:app_token:${appId}`,
                appAccessToken,
                'EX',
                23 * 60 * 60
            );
        }

        return appAccessToken;

    } catch (error) {
        logger.error(`[AppTokenService] API Error generating App Access Token for appId ${appId}: ${error.message}`);
        if (error.response) {
            logger.error(`[AppTokenService] Gupshup API Response: ${JSON.stringify(error.response.data)}`);
            throw new Error(`Gupshup Token API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
        }
        throw new Error(`Failed to generate App Access Token: ${error.message}`);
    }
}

/**
 * Resolve App Access Token from local database using User ID
 * @param {string} userId - The authenticated user's ID
 * @returns {Promise<string>}
 */
async function resolveUserAppAccessToken(userId) {
    logger.info(`[AppTokenService] Resolving App Access Token for user ID: ${userId}`);
    
    // Resolve the User and populate their linked workspace to extract the app ID
    const user = await User.findById(userId).populate('workspace', 'gupshupAppId');
    
    if (!user) {
        throw new Error(`User not found for id: ${userId}`);
    }
    
    if (!user.workspace) {
        throw new Error(`User ${userId} does not have an associated workspace`);
    }
    
    // Legacy support: Some logic might store it at gupshupIdentity.partnerAppId, but we default to gupshupAppId
    const appId = user.workspace.gupshupAppId;
    if (!appId) {
        throw new Error(`Gupshup App ID not configured for workspace of user: ${userId}`);
    }

    return generateAppAccessToken(appId);
}

module.exports = {
    generateAppAccessToken,
    resolveUserAppAccessToken
};
