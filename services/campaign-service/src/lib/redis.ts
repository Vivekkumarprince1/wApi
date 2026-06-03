import IORedis from 'ioredis';
import {
  assertRedisPolicy,
  bullmqConnectionOptions,
  resolveRedisUrl,
} from '@wapi/contracts';

const REDIS_URL = process.env.REDIS_URL || resolveRedisUrl();

const redis = new IORedis(REDIS_URL, {
  ...bullmqConnectionOptions(),
  family: 4,
});

let policyChecked = false;

export async function ensureRedisPolicy() {
  if (policyChecked) return;
  policyChecked = true;
  try {
    await assertRedisPolicy({
      client: redis as any,
      service: 'campaign-service',
    });
  } catch (err: any) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[campaign-service] fatal redis policy error:', err?.message || err);
      process.exit(1);
    }
  }
}

export const getSharedRedis = () => redis;
export default redis;
