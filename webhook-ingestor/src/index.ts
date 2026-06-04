import 'dotenv/config';
import fastify from 'fastify';
import crypto from 'crypto';
import { Kafka } from 'kafkajs';
import { MongoClient } from 'mongodb';

const server = fastify({
  logger: process.env.NODE_ENV !== 'production',
  // Ensure we capture the raw body as a string for precise HMAC validation
  bodyLimit: 1048576, // 1MB
});

const PORT = parseInt(process.env.PORT || '3013', 10);
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';
const KAFKA_BROKER = process.env.KAFKA_BROKER || 'localhost:9092';
const KAFKA_TOPIC = 'raw-webhook-events';
const INTERNAL_SECRET = process.env.INTERNAL_SERVICE_SECRET || 'dev-internal-service-secret-change-me';
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/wapi';
const DEAD_LETTER_COLLECTION = 'webhook_dead_letters';

// --- KAFKA SETUP ---
let kafkaProducer: any = null;
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

async function initKafka() {
  try {
    const kafka = new Kafka({
      clientId: 'wapi-webhook-ingestor',
      brokers: [KAFKA_BROKER],
      connectionTimeout: 3000,
    });

    kafkaProducer = kafka.producer();
    await kafkaProducer.connect();
    console.log(`[Webhook Ingestor] Connected to Kafka Broker at ${KAFKA_BROKER}`);
  } catch (error: any) {
    if (IS_PRODUCTION) {
      throw new Error(`[Webhook Ingestor] Failed to connect to Kafka Broker at ${KAFKA_BROKER}: ${error.message}`);
    }
    simulatedMode = true;
    console.warn(`[Webhook Ingestor] Failed to connect to Kafka (${error.message}). Running in local fallback mode (logging to stdout).`);
  }
}

async function publishRawWebhook(eventId: string, eventMessage: any) {
  if (!kafkaProducer) {
    throw new Error('Kafka producer is not connected');
  }

  await kafkaProducer.send({
    topic: KAFKA_TOPIC,
    messages: [
      {
        key: eventId,
        value: JSON.stringify(eventMessage),
      },
    ],
  });
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

  const digest = crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
  const getHeader = (name: string): string => {
    const val = headers[name];
    return Array.isArray(val) ? val[0] : val || '';
  };

  const signature = getHeader('x-gupshup-signature') || getHeader('x-hub-signature-256');
  const cleanSignature = signature.startsWith('sha256=') ? signature.slice(7) : signature;

  return cleanSignature === digest;
}

// --- ENDPOINTS ---

// Webhook subscription validation endpoint (for Meta/Gupshup subscription setup)
server.get('/webhooks', async (req, reply) => {
  const query = req.query as Record<string, string>;
  const hubChallenge = query['hub.challenge'] || query['challenge'];
  const hubVerifyToken = query['hub.verify_token'] || query['verify_token'];

  const localVerifyToken = process.env.VERIFY_TOKEN || 'wapi-verify-token';

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
  return { status: 'OK', kafkaConnected: !!kafkaProducer && !simulatedMode };
});

// Root path Tunnel check
server.get('/', async () => {
  return { service: 'wapi-webhook-ingestor', healthy: true };
});

async function start() {
  try {
    if (IS_PRODUCTION) {
      const missing = [
        ['WEBHOOK_SECRET', WEBHOOK_SECRET],
        ['INTERNAL_SERVICE_SECRET', process.env.INTERNAL_SERVICE_SECRET],
        ['MONGO_URI or MONGODB_URI', process.env.MONGO_URI || process.env.MONGODB_URI],
        ['KAFKA_BROKER', process.env.KAFKA_BROKER],
      ].filter(([, value]) => !value);

      if (missing.length > 0) {
        throw new Error(`Missing required production env: ${missing.map(([name]) => name).join(', ')}`);
      }
    }

    await initKafka();
    await deadLetterCollection();
    await server.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`[Webhook Ingestor] Server running at http://localhost:${PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start();
