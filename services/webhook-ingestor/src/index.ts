import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  WEBHOOK_SECRET: z.string({
    required_error: 'WEBHOOK_SECRET is required'
  }).min(1, 'WEBHOOK_SECRET cannot be empty'),
  INTERNAL_SERVICE_SECRET: z.string({
    required_error: 'INTERNAL_SERVICE_SECRET is required'
  }).min(1, 'INTERNAL_SERVICE_SECRET cannot be empty'),
  WEBHOOK_VERIFY_TOKEN: z.string().optional(),
  VERIFY_TOKEN: z.string().optional(),
  PORT: z.string().optional(),
  KAFKA_BROKER: z.string().optional(),
  MONGO_URI: z.string().optional(),
  MONGODB_URI: z.string().optional(),
}).refine(data => data.WEBHOOK_VERIFY_TOKEN || data.VERIFY_TOKEN, {
  message: 'Either WEBHOOK_VERIFY_TOKEN or VERIFY_TOKEN must be provided',
  path: ['WEBHOOK_VERIFY_TOKEN']
});

const envParseResult = envSchema.safeParse(process.env);
if (!envParseResult.success) {
  console.error('❌ Environment validation failed for webhook-ingestor:');
  console.error(JSON.stringify(envParseResult.error.format(), null, 2));
  process.exit(1);
}

if (process.env.NODE_ENV === 'production') {
  if (process.env.INTERNAL_SERVICE_SECRET === 'dev-internal-service-secret-change-me') {
    throw new Error('FATAL: A secure, non-default INTERNAL_SERVICE_SECRET environment variable is required in production.');
  }
}

import fastify from 'fastify';
import crypto from 'crypto';
import Redis from 'ioredis';
import { MongoClient } from 'mongodb';

const server = fastify({
  logger: process.env.NODE_ENV !== 'production',
  // Ensure we capture the raw body as a string for precise HMAC validation
  bodyLimit: 1048576, // 1MB
});

const PORT = parseInt(process.env.PORT || '3013', 10);
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET!;
const REDIS_URL = process.env.REDIS_URL || '';
const REDIS_TOPIC = 'raw-webhook-events';
const INTERNAL_SECRET = process.env.INTERNAL_SERVICE_SECRET!;
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/wapi';
const DEAD_LETTER_COLLECTION = 'webhook_dead_letters';


// --- REDIS SETUP ---
let redisProducer: Redis | null = null;
let simulatedMode = false;
let mongoClient: MongoClient | null = null;

async function deadLetterCollection() {
  if (!mongoClient) {
    mongoClient = new MongoClient(MONGO_URI);
    await mongoClient.connect();
    await mongoClient.db().collection(DEAD_LETTER_COLLECTION).createIndex({ eventId: 1 }, { unique: true });
    await mongoClient.db().collection(DEAD_LETTER_COLLECTION).createIndex({ status: 1, createdAt: 1 });
  }
  return mongoClient.db().collection(DEAD_LETTER_COLLECTION);
}

async function initRedis() {
  if (!REDIS_URL) {
    if (IS_PRODUCTION) {
      throw new Error('[Webhook Ingestor] REDIS_URL is missing in production');
    }
    simulatedMode = true;
    console.warn('[Webhook Ingestor] REDIS_URL missing. Running in simulated mode.');
    return;
  }

  try {
    redisProducer = new Redis(REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: null });
    await redisProducer.connect();
    console.log(`[Webhook Ingestor] Connected to Redis`);
  } catch (error: any) {
    if (IS_PRODUCTION) {
      throw new Error(`[Webhook Ingestor] Failed to connect to Redis at ${REDIS_URL}: ${error.message}`);
    }
    simulatedMode = true;
    console.warn(`[Webhook Ingestor] Failed to connect to Redis (${error.message}). Running in local fallback mode (logging to stdout).`);
  }
}

async function publishRawWebhook(eventId: string, eventMessage: any) {
  if (!redisProducer) {
    throw new Error('Redis producer is not connected');
  }

  await redisProducer.publish(
    REDIS_TOPIC,
    JSON.stringify({
      key: eventId,
      value: JSON.stringify(eventMessage),
    })
  );
}

async function persistDeadLetter(eventId: string, eventMessage: any, reason: string) {
  const collection = await deadLetterCollection();
  await collection.updateOne(
    { eventId },
    {
      $set: {
        eventId,
        eventMessage,
        reason,
        status: 'pending',
        updatedAt: new Date(),
      },
      $setOnInsert: {
        attempts: 0,
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );
}

function parseJsonBuffer(body: unknown) {
  if (Buffer.isBuffer(body)) return JSON.parse(body.toString('utf8'));
  if (typeof body === 'string') return JSON.parse(body);
  return body || {};
}

function isInternalRequest(headers: Record<string, any>) {
  return headers['x-internal-service-secret'] === INTERNAL_SECRET;
}

// Custom raw body parser plugin for Fastify (so we can get the exact buffer for crypto)
server.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
  try {
    done(null, body);
  } catch (err: any) {
    done(err);
  }
});

// --- HELPER: Signature Validator ---
function isSignatureValid(rawBody: string, headers: Record<string, string | string[] | undefined>) {
  if (!IS_PRODUCTION && !WEBHOOK_SECRET) {
    return true; // Bypass signature verification in dev modes if secret isn't loaded
  }

  if (!WEBHOOK_SECRET) {
    return false;
  }

  const digest = crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
  const getHeader = (name: string): string => {
    const val = headers[name];
    return Array.isArray(val) ? val[0] : val || '';
  };

  const signature = getHeader('x-gupshup-signature') || getHeader('x-hub-signature-256');
  if (!signature) {
    // Providers only sign webhooks when HMAC is configured on their side. In
    // dev, unsigned deliveries (e.g. Gupshup via ngrok) must still ingest —
    // validate-when-present, allow-when-absent. Production stays strict.
    if (!IS_PRODUCTION) {
      console.warn('[Webhook Ingestor] Unsigned webhook accepted (non-production).');
      return true;
    }
    return false;
  }

  const cleanSignature = signature.startsWith('sha256=') ? signature.slice(7) : signature;

  const cleanSigBuffer = Buffer.from(cleanSignature, 'hex');
  const digestBuffer = Buffer.from(digest, 'hex');

  if (cleanSigBuffer.length !== digestBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(cleanSigBuffer, digestBuffer);
}

// --- ENDPOINTS ---

// Webhook subscription validation endpoint (for Meta/Gupshup subscription setup)
server.get('/webhooks', async (req, reply) => {
  const query = req.query as Record<string, string>;
  const hubChallenge = query['hub.challenge'] || query['challenge'];
  const hubVerifyToken = query['hub.verify_token'] || query['verify_token'];

  const localVerifyToken = process.env.WEBHOOK_VERIFY_TOKEN || process.env.VERIFY_TOKEN || '';

  if (hubChallenge && hubVerifyToken === localVerifyToken) {
    console.log('[Webhook Ingestor] Subscription validation successful.');
    return reply.status(200).send(hubChallenge);
  }

  return reply.status(403).send({ error: 'VERIFICATION_FAILED' });
});

server.get('/webhooks/:provider', async (req, reply) => {
  return server.inject({
    method: 'GET',
    url: `/webhooks?${new URLSearchParams(req.query as Record<string, string>).toString()}`,
  }).then((response) => reply.status(response.statusCode).send(response.body));
});

// Primary Webhook Ingestion endpoint
async function handleWebhookPost(req: any, reply: any, providerParam?: string) {
  const headers = req.headers;
  const rawBodyBuffer = req.body as Buffer;
  const rawBodyString = rawBodyBuffer.toString('utf8');

  // 1. Cryptographic Signature check (Microseconds overhead)
  if (!isSignatureValid(rawBodyString, headers)) {
    console.warn('[Webhook Ingestor] Signature validation failed.');
    return reply.status(401).send({ error: 'INVALID_SIGNATURE' });
  }

  let parsedPayload: any = {};
  try {
    parsedPayload = JSON.parse(rawBodyString);
  } catch (parseErr) {
    return reply.status(400).send({ error: 'INVALID_JSON_BODY' });
  }

  // 2. Resolve target partition or keys
  const eventId = String(
    headers['x-delivery-id'] || 
    headers['x-request-id'] || 
    parsedPayload?.payload?.id || 
    parsedPayload?.id || 
    parsedPayload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.id || 
    Date.now()
  );

  const eventType = parsedPayload?.payload?.status || parsedPayload?.entry?.[0]?.changes?.[0]?.value?.statuses?.[0]
    ? 'message.status'
    : 'message.inbound';

  // 3. Asynchronously push to Kafka (Non-blocking)
  const eventMessage = {
    eventId,
    eventType,
    provider: providerParam || parsedPayload?.provider || 'gupshup',
    timestamp: new Date().toISOString(),
    rawPayload: parsedPayload,
  };

  try {
    await publishRawWebhook(eventId, eventMessage);
  } catch (kafkaErr: any) {
    server.log.error(`[Webhook Ingestor] Kafka dispatch failed: ${kafkaErr.message}`);
    await persistDeadLetter(eventId, eventMessage, kafkaErr.message);
  }

  // 4. Instantly reply with 200 OK (Prevents timeouts & carrier duplicate retries)
  return reply.status(200).send({ success: true, eventId });
}

server.post('/webhooks', async (req, reply) => {
  return handleWebhookPost(req, reply);
});

server.post('/webhooks/:provider', async (req: any, reply) => {
  return handleWebhookPost(req, reply, req.params.provider);
});

server.post('/internal/v1/webhooks/replay', async (req, reply) => {
  if (!isInternalRequest(req.headers)) {
    return reply.status(401).send({ success: false, message: 'Unauthorized' });
  }

  const body = parseJsonBuffer(req.body) as any;
  const limit = Math.min(parseInt(String(body.limit || 50), 10), 200);
  const collection = await deadLetterCollection();
  const pending = await collection.find({ status: 'pending' }).sort({ createdAt: 1 }).limit(limit).toArray();

  let replayed = 0;
  const failed: Array<{ eventId: string; reason: string }> = [];

  for (const item of pending) {
    try {
      await publishRawWebhook(item.eventId, item.eventMessage);
      await collection.updateOne(
        { _id: item._id },
        { $set: { status: 'replayed', replayedAt: new Date(), updatedAt: new Date() }, $inc: { attempts: 1 } }
      );
      replayed += 1;
    } catch (err: any) {
      await collection.updateOne(
        { _id: item._id },
        { $set: { reason: err.message, updatedAt: new Date() }, $inc: { attempts: 1 } }
      );
      failed.push({ eventId: item.eventId, reason: err.message });
    }
  }

  return reply.send({ success: true, replayed, failed });
});

// Health check
server.get('/health', async () => {
  return { status: 'OK', redisConnected: !!redisProducer && !simulatedMode };
});

// Root path Tunnel check
server.get('/', async () => {
  return { service: 'wapi-webhook-ingestor', healthy: true };
});

async function start() {
  try {
    await initRedis();
    await deadLetterCollection();
    await server.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`[Webhook Ingestor] Server running at http://localhost:${PORT}`);
  } catch (err) {
    console.error('[Webhook Ingestor] Fatal startup error:', err);
    if (server.log) server.log.error(err);
    process.exit(1);
  }
}

start();

