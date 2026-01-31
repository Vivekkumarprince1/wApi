const axios = require('axios');
const crypto = require('crypto');
const bspConfig = require('../config/bspConfig');
const BspHealth = require('../models/BspHealth');

const META_API_VERSION = process.env.META_API_VERSION || 'v21.0';
const META_GRAPH_URL = `https://graph.facebook.com/${META_API_VERSION}`;

// Default interval: 6 hours (Meta system tokens can be revoked at any time)
const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1000;

function hashToken(token) {
  if (!token) return null;
  return crypto.createHash('sha256').update(token).digest('hex').slice(0, 12);
}

async function upsertHealth(data) {
  return BspHealth.findOneAndUpdate(
    { key: 'system_token' },
    { $set: data },
    { upsert: true, new: true }
  );
}

/**
 * Validate BSP system user token via Meta debug_token endpoint
 * Required by Meta for continuous token health monitoring.
 */
async function checkSystemTokenHealth() {
  const appId = bspConfig.appId;
  const appSecret = bspConfig.appSecret;
  const systemToken = bspConfig.systemUserToken;

  if (!appId || !appSecret || !systemToken) {
    const error = 'BSP system token or app credentials not configured';
    await upsertHealth({
      status: 'critical',
      isValid: false,
      checkedAt: new Date(),
      error
    });
    console.error('[BSP Health] ❌', error);
    return { isValid: false, error };
  }

  try {
    const response = await axios.get(`${META_GRAPH_URL}/debug_token`, {
      params: {
        input_token: systemToken,
        access_token: `${appId}|${appSecret}`
      },
      timeout: 15000
    });

    const data = response.data?.data || {};
    const isValid = !!data.is_valid;
    const expiresAt = data.expires_at ? new Date(data.expires_at * 1000) : null;
    const secondsLeft = expiresAt ? Math.floor((expiresAt.getTime() - Date.now()) / 1000) : null;

    let status = 'healthy';
    if (!isValid) status = 'critical';
    if (isValid && secondsLeft !== null && secondsLeft < 7 * 24 * 60 * 60) status = 'warning';

    await upsertHealth({
      status,
      isValid,
      expiresAt,
      checkedAt: new Date(),
      lastHealthyAt: isValid ? new Date() : undefined,
      error: null,
      meta: {
        tokenHash: hashToken(systemToken),
        appId: data.app_id,
        userId: data.user_id,
        scopes: data.scopes || []
      }
    });

    if (!isValid) {
      console.error('[BSP Health] ❌ System token invalid');
    } else if (status === 'warning') {
      console.warn('[BSP Health] ⚠️ System token expiring soon');
    } else {
      console.log('[BSP Health] ✅ System token healthy');
    }

    return { isValid, expiresAt, status };
  } catch (err) {
    const error = err.response?.data?.error?.message || err.message;
    await upsertHealth({
      status: 'critical',
      isValid: false,
      checkedAt: new Date(),
      error,
      meta: { tokenHash: hashToken(systemToken) }
    });
    console.error('[BSP Health] ❌ Token health check failed:', error);
    return { isValid: false, error };
  }
}

/**
 * Mark token invalid from runtime API failures (e.g., code 190).
 */
async function markTokenInvalid(reason) {
  await upsertHealth({
    status: 'critical',
    isValid: false,
    checkedAt: new Date(),
    error: reason || 'Token invalid'
  });
}

/**
 * Expose last known health snapshot (no tokens returned)
 */
async function getHealthSnapshot() {
  const doc = await BspHealth.findOne({ key: 'system_token' }).lean();
  if (!doc) return null;
  return {
    status: doc.status,
    isValid: doc.isValid,
    expiresAt: doc.expiresAt,
    checkedAt: doc.checkedAt,
    lastHealthyAt: doc.lastHealthyAt,
    error: doc.error,
    meta: doc.meta
  };
}

/**
 * Start periodic health monitoring
 */
function startBspHealthMonitor() {
  const intervalMs = Number(process.env.BSP_HEALTH_INTERVAL_MS) || DEFAULT_INTERVAL_MS;
  // Run once at startup
  checkSystemTokenHealth().catch(() => null);
  setInterval(() => {
    checkSystemTokenHealth().catch(() => null);
  }, intervalMs);
}

module.exports = {
  checkSystemTokenHealth,
  markTokenInvalid,
  getHealthSnapshot,
  startBspHealthMonitor
};
