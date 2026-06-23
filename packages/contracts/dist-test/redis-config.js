"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.REQUIRED_MAXMEMORY_POLICY = void 0;
exports.readMaxMemoryPolicy = readMaxMemoryPolicy;
exports.assertRedisPolicy = assertRedisPolicy;
exports.bullmqConnectionOptions = bullmqConnectionOptions;
exports.resolveRedisUrl = resolveRedisUrl;
exports.REQUIRED_MAXMEMORY_POLICY = 'noeviction';
function arrayToConfigMap(raw) {
    const out = {};
    if (Array.isArray(raw)) {
        for (let i = 0; i < raw.length; i += 2) {
            const key = String(raw[i] ?? '').toLowerCase();
            const value = String(raw[i + 1] ?? '');
            if (key)
                out[key] = value;
        }
    }
    else if (raw && typeof raw === 'object') {
        for (const [k, v] of Object.entries(raw)) {
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
async function readMaxMemoryPolicy(client) {
    try {
        const raw = await client.config('GET', 'maxmemory-policy');
        const map = arrayToConfigMap(raw);
        return map['maxmemory-policy'] ?? null;
    }
    catch (err) {
        // `CONFIG GET` is sometimes disabled (Upstash, Redis Cloud free, etc.).
        // We can't fix what we can't see; surface a null and let the caller decide.
        return null;
    }
}
async function assertRedisPolicy(options) {
    const { client, environment = process.env.NODE_ENV || 'development', autoFix = process.env.REDIS_AUTO_FIX_POLICY === '1', service, logger = console, } = options;
    const policy = await readMaxMemoryPolicy(client);
    const isProd = environment === 'production';
    const result = {
        policy,
        ok: policy === exports.REQUIRED_MAXMEMORY_POLICY,
        required: exports.REQUIRED_MAXMEMORY_POLICY,
        autoFixed: false,
    };
    if (result.ok)
        return result;
    if (policy === null) {
        logger.warn(`[${service}][redis] could not read maxmemory-policy (CONFIG GET disabled?). ` +
            `Set it to '${exports.REQUIRED_MAXMEMORY_POLICY}' on the server or BullMQ will warn.`);
        return result;
    }
    if (autoFix) {
        try {
            // `client.config` is intentionally untyped here; runtime call is fine.
            await client.config('SET', 'maxmemory-policy', exports.REQUIRED_MAXMEMORY_POLICY);
            const verify = await readMaxMemoryPolicy(client);
            result.policy = verify;
            result.ok = verify === exports.REQUIRED_MAXMEMORY_POLICY;
            result.autoFixed = result.ok;
            if (result.ok) {
                logger.info(`[${service}][redis] auto-fixed maxmemory-policy → '${exports.REQUIRED_MAXMEMORY_POLICY}'`);
                return result;
            }
        }
        catch (err) {
            logger.warn(`[${service}][redis] auto-fix failed: ${err?.message || err}. Continuing.`);
        }
    }
    const message = `[${service}][redis] maxmemory-policy is '${policy}', but BullMQ requires ` +
        `'${exports.REQUIRED_MAXMEMORY_POLICY}'. Run \`redis-cli config set maxmemory-policy ` +
        `${exports.REQUIRED_MAXMEMORY_POLICY}\` (or set REDIS_AUTO_FIX_POLICY=1).`;
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
function bullmqConnectionOptions() {
    return {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
    };
}
/**
 * Suggest a Redis URL from env, with a sensible fallback. Centralised
 * here so every service uses the same logic.
 */
function resolveRedisUrl() {
    return (process.env.REDIS_URL ||
        process.env.REDIS_URI ||
        'redis://127.0.0.1:6379');
}
