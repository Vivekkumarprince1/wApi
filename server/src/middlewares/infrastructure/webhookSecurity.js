const bspConfig = require('../../config/bspConfig');
const { getRedis } = require('../../config/redis');

const SKIP_IP_CHECK = process.env.SKIP_WEBHOOK_IP_CHECK === 'true';
const REPLAY_TTL_SECONDS = 300;

function extractClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded && typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }

  return req.ip || req.connection?.remoteAddress || '';
}

function isAllowedIp(ip) {
  const allowed = bspConfig.gupshup.webhookAllowedIPs || [];
  if (allowed.length === 0) {
    return true;
  }

  return allowed.includes(ip);
}

async function verifyWebhookIp(req, res, next) {
  if (SKIP_IP_CHECK) {
    req.webhookVerified = true;
    return next();
  }

  const ip = extractClientIp(req);
  if (!isAllowedIp(ip)) {
    return res.status(403).json({ error: 'Webhook source IP not allowed' });
  }

  req.webhookVerified = true;
  req.webhookSourceIp = ip;
  next();
}

async function isReplayAttack(deliveryId) {
  if (!deliveryId) return false;

  try {
    const redis = getRedis();
    const key = `webhook:gupshup:${deliveryId}`;
    const result = await redis.set(key, Date.now().toString(), {
      NX: true,
      EX: REPLAY_TTL_SECONDS
    });

    return result !== 'OK';
  } catch (error) {
    console.warn('[WebhookSecurity] Replay check unavailable:', error.message);
    return false;
  }
}

async function replayProtection(req, res, next) {
  const deliveryId = req.headers['x-delivery-id'] || req.headers['x-request-id'];
  if (deliveryId && await isReplayAttack(deliveryId)) {
    return res.status(403).json({ error: 'Duplicate delivery' });
  }

  next();
}

const webhookSecurityMiddleware = [
  verifyWebhookIp,
  replayProtection
];

module.exports = {
  verifyWebhookIp,
  replayProtection,
  isReplayAttack,
  webhookSecurityMiddleware
};
