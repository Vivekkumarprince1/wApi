const { createClient } = require('redis');
const { redisUrl } = require('./index');

const shouldSkipRedis = process.env.SKIP_REDIS === 'true';
let client;

async function connectRedis() {
  if (shouldSkipRedis) {
    console.log('Redis connection skipped (SKIP_REDIS=true)');
    return null;
  }

  client = createClient({ url: redisUrl });
  client.on('error', (err) => console.error('Redis Client Error', err));
  await client.connect();
  console.log('Redis connected');
  return client;
}

function getRedis() {
  if (shouldSkipRedis) {
    throw new Error('Redis usage requested but SKIP_REDIS=true');
  }
  if (!client) throw new Error('Redis client not initialized');
  return client;
}

module.exports = { connectRedis, getRedis };
