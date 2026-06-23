import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis, { RedisOptions } from 'ioredis';
import { config } from '../config';

const MAX_REDIS_RECONNECT_ATTEMPTS = 5;

export function createRedisClient(
  label = 'bsp-service',
  redisUrl = config.redisUrl,
  options: RedisOptions = {},
) {
  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times) {
      if (times > MAX_REDIS_RECONNECT_ATTEMPTS) return null;
      return Math.min(times * 500, 5000);
    },
    ...options,
  });

  const loggedMessages = new Set<string>();
  client.on('error', (err) => {
    if (loggedMessages.has(err.message)) return;
    loggedMessages.add(err.message);
    console.warn(`[${label}] Redis connection unavailable: ${err.message}`);
  });

  client.on('ready', () => {
    loggedMessages.clear();
  });

  return client;
}

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis | null;

  constructor() {
    const redisCacheEnabled =
      process.env.ENABLE_REDIS_CACHE === 'true' || process.env.NODE_ENV === 'production';
    this.client = redisCacheEnabled ? createRedisClient('bsp-cache') : null;
    if (!redisCacheEnabled) {
      console.log('[bsp-cache] Redis cache disabled for local development. Set ENABLE_REDIS_CACHE=true to enable it.');
    }
  }

  getClient(): Redis {
    if (!this.client) {
      throw new Error('Redis cache is disabled');
    }
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) return null;
    try {
      return await this.client.get(key);
    } catch {
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.client) return;
    try {
      if (ttlSeconds) {
        await this.client.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, value);
      }
    } catch {
      return;
    }
  }

  async getJson<T>(key: string): Promise<T | null> {
    const data = await this.get(key);
    if (!data) return null;
    try {
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const stringified = JSON.stringify(value);
    await this.set(key, stringified, ttlSeconds);
  }

  async del(key: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.del(key);
    } catch {
      return;
    }
  }

  async acquireLock(key: string, ttlSeconds = 60): Promise<boolean> {
    if (!this.client) return false;
    const lockValue = `${Date.now()}:${Math.random().toString(36).slice(2)}`;
    try {
      const result = await this.client.set(key, lockValue, 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    } catch {
      return false;
    }
  }

  async releaseLock(key: string): Promise<void> {
    await this.del(key);
  }

  onModuleDestroy() {
    this.client?.disconnect();
  }
}
