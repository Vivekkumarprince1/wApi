import * as assert from 'node:assert/strict';
import {
  assertRedisPolicy,
  REQUIRED_MAXMEMORY_POLICY,
  bullmqConnectionOptions,
  resolveRedisUrl,
} from '../redis-config';

function test(name: string, fn: () => Promise<void> | void) {
  Promise.resolve()
    .then(fn)
    .then(
      () => console.log(`  ok  ${name}`),
      (err) => {
        console.error(`  FAIL  ${name}`);
        console.error(err);
        process.exitCode = 1;
      }
    );
}

interface FakeClient {
  config: (...args: any[]) => Promise<any>;
  setCalls: any[][];
  policy: string;
}

function makeClient(initialPolicy: string): FakeClient {
  const setCalls: any[][] = [];
  let policy = initialPolicy;
  return {
    setCalls,
    get policy() {
      return policy;
    },
    config: async (...args: any[]) => {
      const [op, key, value] = args;
      if (op === 'GET' && key === 'maxmemory-policy') {
        return ['maxmemory-policy', policy];
      }
      if (op === 'SET' && key === 'maxmemory-policy') {
        setCalls.push(args);
        policy = value;
        return 'OK';
      }
      throw new Error(`unexpected config call: ${args.join(',')}`);
    },
  };
}

console.log('redis-config');

test('bullmqConnectionOptions sets the required flags', () => {
  const opts = bullmqConnectionOptions();
  assert.equal(opts.maxRetriesPerRequest, null);
  assert.equal(opts.enableReadyCheck, false);
});

test('assertRedisPolicy returns ok when policy already matches', async () => {
  const client = makeClient(REQUIRED_MAXMEMORY_POLICY);
  const snapshot = await assertRedisPolicy({
    client: client as any,
    service: 'unit-test',
    environment: 'production',
    logger: { warn: () => {}, error: () => {}, info: () => {} },
  });
  assert.equal(snapshot.ok, true);
  assert.equal(snapshot.policy, REQUIRED_MAXMEMORY_POLICY);
  assert.equal(client.setCalls.length, 0);
});

test('assertRedisPolicy warns in development on mismatch', async () => {
  const client = makeClient('volatile-lru');
  const warnings: string[] = [];
  const snapshot = await assertRedisPolicy({
    client: client as any,
    service: 'unit-test',
    environment: 'development',
    autoFix: false,
    logger: { warn: (m) => warnings.push(m), error: () => {}, info: () => {} },
  });
  assert.equal(snapshot.ok, false);
  assert.ok(warnings.some((w) => w.includes('volatile-lru')));
});

test('assertRedisPolicy fails fast in production', async () => {
  const client = makeClient('volatile-lru');
  await assert.rejects(
    assertRedisPolicy({
      client: client as any,
      service: 'unit-test',
      environment: 'production',
      autoFix: false,
      logger: { warn: () => {}, error: () => {}, info: () => {} },
    }),
    /REDIS_POLICY_INVALID/
  );
});

test('assertRedisPolicy applies autoFix when requested', async () => {
  const client = makeClient('volatile-lru');
  const snapshot = await assertRedisPolicy({
    client: client as any,
    service: 'unit-test',
    environment: 'development',
    autoFix: true,
    logger: { warn: () => {}, error: () => {}, info: () => {} },
  });
  assert.equal(snapshot.ok, true);
  assert.equal(snapshot.autoFixed, true);
  assert.equal(client.policy, REQUIRED_MAXMEMORY_POLICY);
});

test('resolveRedisUrl prefers Valkey env vars and falls back to Redis env vars', () => {
  const original = {
    VALKEY_URL: process.env.VALKEY_URL,
    VALKEY_URI: process.env.VALKEY_URI,
    REDIS_URL: process.env.REDIS_URL,
    REDIS_URI: process.env.REDIS_URI,
  };

  try {
    delete process.env.VALKEY_URL;
    delete process.env.VALKEY_URI;
    delete process.env.REDIS_URL;
    delete process.env.REDIS_URI;

    process.env.REDIS_URL = 'redis://redis.example:6379';
    assert.equal(resolveRedisUrl(), 'redis://redis.example:6379');

    process.env.VALKEY_URL = 'redis://valkey.example:6379';
    assert.equal(resolveRedisUrl(), 'redis://valkey.example:6379');

    delete process.env.VALKEY_URL;
    process.env.VALKEY_URI = 'rediss://valkey-uri.example:6380';
    assert.equal(resolveRedisUrl(), 'rediss://valkey-uri.example:6380');
  } finally {
    for (const key of Object.keys(original) as Array<keyof typeof original>) {
      const value = original[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});
