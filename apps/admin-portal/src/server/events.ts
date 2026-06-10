import "server-only";
import { Queue } from "bullmq";
import IORedis from "ioredis";
function resolveRedisUrl() {
  return process.env.REDIS_URL || "redis://localhost:6379";
}

function bullmqConnectionOptions(): IORedis {
  return getRedis();
}

/**
 * Side-effect publisher for the self-contained admin portal.
 *
 * When the admin writes directly to Mongo (bypassing the services), the
 * services' BullMQ jobs / Redis pub-sub / cache invalidation would normally
 * not fire. This module lets the portal reproduce those side-effects itself:
 *   - enqueue BullMQ jobs on the shared queues (same names via @wapi/contracts)
 *   - publish Redis pub-sub events the services listen for
 *   - bust the session/workspace caches the services read
 *
 * Connections are cached on globalThis (Next dev HMR / serverless reuse).
 */

const globalForEvents = globalThis as unknown as {
  __adminRedis?: IORedis;
  __adminQueues?: Map<string, Queue>;
};

export function getRedis(): IORedis {
  if (!globalForEvents.__adminRedis) {
    globalForEvents.__adminRedis = new IORedis(resolveRedisUrl(), {
      maxRetriesPerRequest: null,
      lazyConnect: false,
    });
  }
  return globalForEvents.__adminRedis;
}

function getQueue(name: string): Queue {
  if (!globalForEvents.__adminQueues) globalForEvents.__adminQueues = new Map();
  const cache = globalForEvents.__adminQueues;
  let q = cache.get(name);
  if (!q) {
    q = new Queue(name, { connection: bullmqConnectionOptions() as any });
    cache.set(name, q);
  }
  return q;
}

/** Enqueue a BullMQ job on a shared queue (best-effort; logs on failure). */
export async function enqueue(
  queueName: string,
  jobName: string,
  data: Record<string, unknown>
): Promise<void> {
  try {
    await getQueue(queueName).add(jobName, data, {
      removeOnComplete: 100,
      removeOnFail: 200,
    });
  } catch (err) {
    console.error(`[admin-portal/events] enqueue ${queueName}/${jobName} failed:`, err);
  }
}

/** Publish a Redis pub-sub message the services subscribe to (best-effort). */
export async function publish(channel: string, payload: unknown): Promise<void> {
  try {
    await getRedis().publish(channel, JSON.stringify(payload));
  } catch (err) {
    console.error(`[admin-portal/events] publish ${channel} failed:`, err);
  }
}

/**
 * Invalidate cached session/workspace state so services re-read fresh data
 * after a direct write. Mirrors the cache keys the platform uses; deletes are
 * best-effort and pattern-based.
 */
export async function invalidateWorkspaceCache(workspaceId: string): Promise<void> {
  try {
    const redis = getRedis();
    const patterns = [
      `session:*:${workspaceId}`,
      `workspace:${workspaceId}`,
      `workspace:${workspaceId}:*`,
      `entitlements:${workspaceId}`,
    ];
    for (const pattern of patterns) {
      if (pattern.includes("*")) {
        const keys = await redis.keys(pattern);
        if (keys.length) await redis.del(...keys);
      } else {
        await redis.del(pattern);
      }
    }
  } catch (err) {
    console.error(`[admin-portal/events] cache invalidation for ${workspaceId} failed:`, err);
  }
}

export async function invalidateUserCache(userId: string): Promise<void> {
  try {
    const redis = getRedis();
    const keys = await redis.keys(`session:${userId}:*`);
    if (keys.length) await redis.del(...keys);
  } catch (err) {
    console.error(`[admin-portal/events] user cache invalidation for ${userId} failed:`, err);
  }
}
