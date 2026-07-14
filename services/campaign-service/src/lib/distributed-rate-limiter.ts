import type IORedis from 'ioredis';

const ACQUIRE_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[2]) end
local ttl = redis.call('PTTL', KEYS[1])
if current <= tonumber(ARGV[1]) then return {1, current, ttl} end
return {0, current, ttl}
`;

export class DistributedRateLimiter {
  constructor(private readonly redis: IORedis) {}

  async acquire(input: { workspaceId: string; appId: string; limit: number; windowMs?: number }) {
    const windowMs = Math.max(100, input.windowMs || 1000);
    const bucket = Math.floor(Date.now() / windowMs);
    const key = `rate:gupshup:${input.workspaceId}:${input.appId}:${bucket}`;
    const result = await this.redis.eval(ACQUIRE_SCRIPT, 1, key, Math.max(1, input.limit), windowMs) as number[];
    return { allowed: Number(result[0]) === 1, retryAfterMs: Math.max(25, Number(result[2]) || windowMs) };
  }

  async wait(input: { workspaceId: string; appId: string; limit: number; windowMs?: number }) {
    while (true) {
      const result = await this.acquire(input);
      if (result.allowed) return;
      await new Promise((resolve) => setTimeout(resolve, result.retryAfterMs));
    }
  }
}