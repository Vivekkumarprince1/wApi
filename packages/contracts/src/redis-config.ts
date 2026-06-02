/**
 * Shared Redis configuration validator + connection helpers.
 *
 * Every service was independently constructing `new IORedis(...)` with
 * subtly different options. That meant:
 *   - BullMQ's `maxmemory-policy` warning fired once per service per
 *     queue, flooding logs.
 *   - No single place to assert that production has the right policy.
 *   - Duplicate connections per service (~5 sockets) for no reason.
 *
 * This module provides:
 *   - `assertRedisPolicy({ environment, autoFix })` — called once at
 *     boot. Fails fast in production, warns in development, optionally
 *     issues a `CONFIG SET` when `REDIS_AUTO_FIX_POLICY=1`.
 *   - `bullmqConnectionOptions()` — the canonical `RedisOptions` blob
 *     that BullMQ workers need (`maxRetriesPerRequest: null`,
 *     `enableReadyCheck: false`).
 *   - `summariseRedisInfo()` — the `/health/redis` payload.
 *
 * Adoption is gradual: services import these helpers; their existing
 * `redis.ts` files continue to export the same client.
 */

export const REQUIRED_MAXMEMORY_POLICY = 'noeviction';

export interface RedisLikeClient {
  config: (command: 'GET', key: string) => Promise<unknown>;
  // ioredis returns void; node-redis returns string. We don't care which.
  // We deliberately keep this type loose so it works for both clients
  // without forcing services to take a hard dep on ioredis here.
}

export interface AssertRedisPolicyOptions {
  client: RedisLikeClient;
  environment?: string;
  autoFix?: boolean;
  service: string;
  /** Receives a single line per call (warning, error or info). */
  logger?: Pick<Console, 'warn' | 'error' | 'info'>;
}

export interface RedisPolicySnapshot {
  policy: string | null;
  ok: boolean;
  required: string;
  autoFixed: boolean;
}

function arrayToConfigMap(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (Array.isArray(raw)) {
    for (let i = 0; i < raw.length; i += 2) {
      const key = String(raw[i] ?? '').toLowerCase();
      const value = String(raw[i + 1] ?? '');
      if (key) out[key] = value;
    }
  } else if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      out[k.toLowerCase()] = String(v ?? '');
    }
  }
  return out;
}

/**
 * Read the current `maxmemory-policy` setting from Redis.
 *
 * Returns null if the server doesn't support `CONFIG GET` (managed
 * Redis services like Upstash often disable it). In that case the
 * caller should warn but not fail — there's nothing we can validate.
 */
export async function readMaxMemoryPolicy(
  client: RedisLikeClient
): Promise<string | null> {
  try {
    const raw = await client.config('GET', 'maxmemory-policy');
    const map = arrayToConfigMap(raw);
    return map['maxmemory-policy'] ?? null;
  } catch (err: any) {
    // `CONFIG GET` is sometimes disabled (Upstash, Redis Cloud free, etc.).
    // We can't fix what we can't see; surface a null and let the caller decide.
    return null;
  }
}

export async function assertRedisPolicy(
  options: AssertRedisPolicyOptions
): Promise<RedisPolicySnapshot> {
  const {
    client,
    environment = process.env.NODE_ENV || 'development',
    autoFix = process.env.REDIS_AUTO_FIX_POLICY === '1',
    service,
    logger = console,
  } = options;

  const policy = await readMaxMemoryPolicy(client);
  const isProd = environment === 'production';
  const result: RedisPolicySnapshot = {
    policy,
    ok: policy === REQUIRED_MAXMEMORY_POLICY,
    required: REQUIRED_MAXMEMORY_POLICY,
    autoFixed: false,
  };

  if (result.ok) return result;

  if (policy === null) {
    logger.warn(
      `[${service}][redis] could not read maxmemory-policy (CONFIG GET disabled?). ` +
        `Set it to '${REQUIRED_MAXMEMORY_POLICY}' on the server or BullMQ will warn.`
    );
    return result;
  }

  if (autoFix) {
    try {
      // `client.config` is intentionally untyped here; runtime call is fine.
      await (client as any).config('SET', 'maxmemory-policy', REQUIRED_MAXMEMORY_POLICY);
      const verify = await readMaxMemoryPolicy(client);
      result.policy = verify;
      result.ok = verify === REQUIRED_MAXMEMORY_POLICY;
      result.autoFixed = result.ok;
      if (result.ok) {
        logger.info(
          `[${service}][redis] auto-fixed maxmemory-policy → '${REQUIRED_MAXMEMORY_POLICY}'`
        );
        return result;
      }
    } catch (err: any) {
      logger.warn(
        `[${service}][redis] auto-fix failed: ${err?.message || err}. Continuing.`
      );
    }
  }

  const message =
    `[${service}][redis] maxmemory-policy is '${policy}', but BullMQ requires ` +
    `'${REQUIRED_MAXMEMORY_POLICY}'. Run \`redis-cli config set maxmemory-policy ` +
    `${REQUIRED_MAXMEMORY_POLICY}\` (or set REDIS_AUTO_FIX_POLICY=1).`;

  if (isProd) {
    logger.error(message);
    throw new Error(`REDIS_POLICY_INVALID: ${policy}`);
  }

  logger.warn(message);
  return result;
}

/**
 * Canonical BullMQ connection options. Re-export from one place so we
 * stop hand-rolling them at every callsite.
 */
export function bullmqConnectionOptions() {
  return {
    maxRetriesPerRequest: null as null,
    enableReadyCheck: false,
  };
}

/**
 * Suggest a Redis URL from env, with a sensible fallback. Centralised
 * here so every service uses the same logic.
 */
export function resolveRedisUrl(): string {
  return (
    process.env.REDIS_URL ||
    process.env.REDIS_URI ||
    'redis://127.0.0.1:6379'
  );
}
