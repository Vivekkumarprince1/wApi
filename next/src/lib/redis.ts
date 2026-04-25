/**
 * REDIS CLIENT
 * Persistent Redis connection with JSON helpers for state management.
 * Parity with legacy backend/config/redis.js
 */

import { createClient, RedisClientType } from 'redis';
import { config } from './config';

let client: RedisClientType | null = null;

export async function connectRedis(): Promise<RedisClientType | null> {
  if (config.skipRedis) {
    console.log('Redis connection skipped (SKIP_REDIS=true)');
    return null;
  }

  if (client) {
    if (client.isOpen) return client;
    console.warn('[Redis] Connection is closed, attempting re-connect...');
    client = null; // Reset to allow re-creation
  }

  try {
    const redisClient = createClient({
      url: config.redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('[Redis] Retry limit reached');
            return new Error('Retry limit reached');
          }
          return Math.min(retries * 500, 5000);
        },
      },
    });

    redisClient.on('error', (err) => {
      console.error('[Redis] Error:', err.message);
    });

    await redisClient.connect();
    console.log('[Redis] Connected to Redis');
    
    client = redisClient as RedisClientType;
    return client;
  } catch (err: any) {
    console.warn('[Redis] Connection failed:', err.message);
    return null;
  }
}

export function getRedis(): RedisClientType {
  if (config.skipRedis) {
    throw new Error('Redis usage requested but SKIP_REDIS=true');
  }
  if (!client || !client.isOpen) {
    throw new Error('Redis client not initialized or closed. Call connectRedis() first.');
  }
  return client;
}

/**
 * Stores JSON payload with optional TTL
 */
export async function setJson(key: string, value: any, ttlSeconds?: number): Promise<void> {
  await connectRedis();
  const redis = getRedis();
  const payload = JSON.stringify(value);
  if (ttlSeconds && Number.isFinite(ttlSeconds)) {
    await redis.set(key, payload, { EX: ttlSeconds });
  } else {
    await redis.set(key, payload);
  }
}

/**
 * Retrieves and parses JSON payload
 */
export async function getJson<T>(key: string): Promise<T | null> {
  await connectRedis();
  const redis = getRedis();
  const raw = await redis.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    return null;
  }
}

/**
 * Deletes key
 */
export async function deleteKey(key: string): Promise<void> {
  await connectRedis();
  const redis = getRedis();
  await redis.del(key);
}
