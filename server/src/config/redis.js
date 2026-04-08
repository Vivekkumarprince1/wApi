const { createClient } = require('redis');
const { redisUrl } = require('./index');

const shouldSkipRedis = process.env.SKIP_REDIS === 'true';
let client;

async function connectRedis() {
  if (shouldSkipRedis) {
    console.log('Redis connection skipped (SKIP_REDIS=true)');
    return null;
  }

  try {
    client = createClient({ 
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) return new Error('Retry limit reached');
          return Math.min(retries * 500, 5000);
        }
      }
    });

    client.on('error', (err) => {
      // Log but don't crash the process
      console.error('[SharedRedis] Error:', err.message);
    });

    await client.connect();
    console.log('[SharedRedis] Connected to Redis');
    return client;
  } catch (err) {
    console.warn('[SharedRedis] Initial connection failed:', err.message);
    // Don't rethrow, let server.js handle the null/undefined connection
    return null;
  }
}

function getRedis() {
  if (shouldSkipRedis) {
    throw new Error('Redis usage requested but SKIP_REDIS=true');
  }
  if (!client) throw new Error('Redis client not initialized');
  return client;
}

// Helper: store JSON with TTL (required for OTP/state durability across instances)
async function setJson(key, value, ttlSeconds) {
  const redis = getRedis();
  const payload = JSON.stringify(value);
  if (ttlSeconds && Number.isFinite(ttlSeconds)) {
    await redis.set(key, payload, { EX: ttlSeconds });
  } else {
    await redis.set(key, payload);
  }
}

// Helper: read JSON safely
async function getJson(key) {
  const redis = getRedis();
  const raw = await redis.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

// Helper: delete key
async function deleteKey(key) {
  const redis = getRedis();
  await redis.del(key);
}

module.exports = { connectRedis, getRedis, setJson, getJson, deleteKey };
