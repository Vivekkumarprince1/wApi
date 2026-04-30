/**
 * REDIS CLIENT
 * Persistent Redis connection with JSON helpers for state management.
 * Refactored to use ioredis under the hood for consolidation.
 */

import { getSharedConnection } from './ioredis';
import { config } from './config';

export async function connectRedis(): Promise<any> {
  if (config.skipRedis) {
    console.log('Redis connection skipped (SKIP_REDIS=true)');
    return null;
  }
  return getSharedConnection();
}

export function getRedis(): any {
  if (config.skipRedis) {
    throw new Error('Redis usage requested but SKIP_REDIS=true');
  }
  return getSharedConnection();
}

/**
 * Stores JSON payload with optional TTL
 */
export async function setJson(key: string, value: any, ttlSeconds?: number): Promise<void> {
  if (config.skipRedis) return;
  const redis = getSharedConnection();
  const payload = JSON.stringify(value);
  if (ttlSeconds && Number.isFinite(ttlSeconds)) {
    await redis.set(key, payload, 'EX', ttlSeconds);
  } else {
    await redis.set(key, payload);
  }
}

/**
 * Retrieves and parses JSON payload
 */
export async function getJson<T>(key: string): Promise<T | null> {
  if (config.skipRedis) return null;
  const redis = getSharedConnection();
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
  if (config.skipRedis) return;
  const redis = getSharedConnection();
  await redis.del(key);
}

