import 'dotenv/config';

import crypto from 'crypto';
import { createServer } from 'http';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import { initWorkers } from './services/worker-registry';
import { initSocketEmitter } from './services/socket-emitter';
import { initSocketServer } from './services/socket-server';
import { authRateLimit, apiRateLimit, bulkRateLimit } from './middlewares/rateLimitMiddleware';
import { correlationIdMiddleware, logger } from './utils/logger';
import authRoutes from './routes/authRoutes';
import webhookRoutes from './routes/webhookRoutes';
import healthRoutes from './routes/healthRoutes';
import contactRoutes from './routes/contactRoutes';
import messageRoutes from './routes/messageRoutes';
import conversationRoutes from './routes/conversationRoutes';
import commerceRoutes from './routes/commerceRoutes';
import adminRoutes from './routes/adminRoutes';
import workspaceRoutes from './routes/workspaceRoutes';
import settingsRoutes from './routes/settingsRoutes';
import templateRoutes from './routes/templateRoutes';
import onboardingRoutes from './routes/onboardingRoutes';
import businessRoutes from './routes/businessRoutes';

import flowRoutes from './routes/flowRoutes';
import uploadRoutes from './routes/uploadRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import metricsRoutes from './routes/metricsRoutes';
import integrationRoutes from './routes/integrationRoutes';
import adsRoutes from './routes/adsRoutes';
import supportRoutes from './routes/supportRoutes';
import widgetRoutes from './routes/widgetRoutes';
import bulkOperationsRoutes from './routes/bulkOperationsRoutes';
import internalRoutes from './routes/internalRoutes';
import compatRoutes from './routes/compatRoutes';
import { registerMergedGatewayRoutes } from './routes/mergedGatewayRoutes';

// --- STARTUP GUARDS ---
const requiredEnv = ['JWT_SECRET', 'MONGODB_URI', 'INTERNAL_SERVICE_SECRET'];
const missingEnv = requiredEnv.filter(key => !process.env[key]);
if (!process.env.VALKEY_URL && !process.env.VALKEY_URI && !process.env.REDIS_URL && !process.env.REDIS_URI) {
  missingEnv.push('VALKEY_URL (or REDIS_URL)');
}

if (missingEnv.length > 0) {
  console.error(`\x1b[41m\x1b[37m FATAL: Missing required environment variables: ${missingEnv.join(', ')} \x1b[0m`);
  process.exit(1);
}

if (process.env.INTERNAL_SERVICE_SECRET === 'your-service-secret') {
  console.warn("\x1b[33m[Main Server] WARNING: Using default INTERNAL_SERVICE_SECRET. Change this for production.\x1b[0m");
}

const internalSecretFingerprint = crypto
  .createHash('sha256')
  .update(process.env.INTERNAL_SERVICE_SECRET || '')
  .digest('hex')
  .slice(0, 8);
console.log(`[Main Server] INTERNAL_SERVICE_SECRET fingerprint: ${internalSecretFingerprint}`);

const app = express();
const httpServer = createServer(app);
const port = parseInt(process.env.BACKEND_PORT || process.env.PORT || "5001", 10);
console.log(`[Main Server] Configured port: ${port} (BACKEND_PORT=${process.env.BACKEND_PORT}, PORT=${process.env.PORT})`);
const resolveEnvSource = (keys: string[]) => keys.find((key) => Boolean(process.env[key]?.trim())) || 'missing';
console.log(
  `[Main Server] WhatsApp webhook config: urlSource=${resolveEnvSource(['WHATSAPP_WEBHOOK_URL', 'GUPSHUP_WEBHOOK_URL', 'WEBHOOK_URL'])}, secretSource=${resolveEnvSource(['GUPSHUP_WEBHOOK_SECRET', 'WHATSAPP_WEBHOOK_SECRET', 'WHATSAPP_WEBHOOK_SIGNING_SECRET', 'GUPSHUP_CALLBACK_SECRET', 'GUPSHUP_WEBHOOK_TOKEN', 'WEBHOOK_SECRET'])}, verifyTokenConfigured=${Boolean(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim())}`
);

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001"
];

// --- MIDDLEWARES ---
app.use(helmet());
app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
  credentials: true
}));
// Stamp every request with an x-correlation-id (echoed on response) so
// logs/jobs/cross-service calls can be traced as a single flow.
app.use(correlationIdMiddleware);
// Verbose dev-style logs only in development. Use 'combined' in
// production for proxy-friendly access logs.
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({
  verify: (req: any, res, buf) => {
    req.rawBody = buf.toString();
  }
}));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser() as any);

// --- DATABASE ---
// Connect is awaited inside startServer() below, before httpServer.listen().
// Mongoose buffering is disabled there to surface "DB not connected" errors
// instead of silently queueing operations.


// --- ROUTES ---
import crmRoutes from './routes/crmRoutes';

import developerRoutes from './routes/developerRoutes';

import { authenticate } from './middlewares/authMiddleware';

registerMergedGatewayRoutes(app);

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/super-admin', adminRoutes);
app.use('/api/v1/contacts', apiRateLimit, contactRoutes);
app.use('/api/v1/bulk', bulkRateLimit, bulkOperationsRoutes);
app.use('/api/v1/conversations', apiRateLimit, conversationRoutes);
app.use('/api/v1/workspace', apiRateLimit, workspaceRoutes);
app.use('/api/v1/settings', apiRateLimit, settingsRoutes);
app.use('/api/v1/developer', apiRateLimit, developerRoutes);
app.use('/api/v1/inbox', apiRateLimit, messageRoutes);
app.use('/api/v1/commerce', commerceRoutes);
app.use('/api/v1/crm', crmRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/health', healthRoutes);



app.use('/api/v1', compatRoutes);
app.use('/api/v1/templates', templateRoutes);
app.use('/api/v1/onboarding', onboardingRoutes);
app.use('/api/v1/business', businessRoutes);

app.use('/api/v1/flows', flowRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/metrics', metricsRoutes);
app.use('/api/v1/integrations', integrationRoutes);
app.use('/api/v1/ads', adsRoutes);
app.use('/api/v1/support', supportRoutes);
app.use('/api/v1/widget', widgetRoutes);
app.use('/api/internal', internalRoutes);

import { HealthService } from './services/health-service';
import { getSharedConnection, ensureRedisPolicy } from './utils/ioredis';
import { readMaxMemoryPolicy, REQUIRED_MAXMEMORY_POLICY, resolveRedisUrl } from '@wapi/contracts';

app.get('/health', async (req, res) => {
  const report = await HealthService.getFullReport();
  res.json(report);
});

app.get('/live', (_req, res) => {
  res.json({ status: 'ok', service: 'core-server', uptime: process.uptime() });
});

app.get('/ready', async (_req, res) => {
  const dbOk = mongoose.connection.readyState === 1;
  let redisOk = false;
  try {
    const conn = getSharedConnection();
    redisOk = (await conn.ping()) === 'PONG';
  } catch {
    redisOk = false;
  }
  const ok = dbOk && redisOk;
  res.status(ok ? 200 : 503).json({
    status: ok ? 'ready' : 'not_ready',
    service: 'core-server',
    db: dbOk ? 'ok' : 'down',
    redis: redisOk ? 'ok' : 'down',
  });
});

app.get('/health/redis', async (_req, res) => {
  try {
    const conn = getSharedConnection();
    const policy = await readMaxMemoryPolicy(conn as any);
    const ok = policy === REQUIRED_MAXMEMORY_POLICY;
    res.json({
      service: 'core-server',
      policy,
      required: REQUIRED_MAXMEMORY_POLICY,
      ok,
      url: resolveRedisUrl().replace(/:[^:@\/]*@/, ':***@'),
    });
  } catch (err: any) {
    res.status(503).json({ ok: false, error: err?.message || String(err) });
  }
});

app.get('/metrics', (_req, res) => {
  const mem = process.memoryUsage();
  const lines = [
    `# HELP process_uptime_seconds Process uptime`,
    `# TYPE process_uptime_seconds gauge`,
    `process_uptime_seconds ${process.uptime()}`,
    `# HELP process_resident_memory_bytes RSS memory`,
    `# TYPE process_resident_memory_bytes gauge`,
    `process_resident_memory_bytes ${mem.rss}`,
    `# HELP process_heap_used_bytes V8 heap used`,
    `# TYPE process_heap_used_bytes gauge`,
    `process_heap_used_bytes ${mem.heapUsed}`,
  ];
  res.type('text/plain').send(lines.join('\n') + '\n');
});

// --- ROOT ENDPOINT (for tunnel connectivity verification) ---
// Localtunnel and other tunneling services test connectivity by making requests to /
// Must respond quickly with 200 OK
app.get('/', (req: express.Request, res: express.Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'wapi-server',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// --- ERROR HANDLING ---
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';

app.use(notFoundHandler);
app.use(errorHandler);


// --- START SERVER ---
async function startServer() {
  const startupTimeout = setTimeout(() => {
    console.warn("\x1b[33m[Main Server] WARNING: Startup taking longer than 20 seconds\x1b[0m");
    console.warn("\x1b[33m[Main Server] Check MongoDB and Redis connections\x1b[0m");
  }, 20000);

  try {
    // Disable buffering so DB ops fail fast if Mongo isn't ready instead
    // of queueing silently.
    mongoose.set('bufferCommands', false);
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log("[Main Server] Connected to MongoDB");

    await ensureRedisPolicy();

    initWorkers();
    initSocketEmitter();
    initSocketServer(httpServer);
    console.log("[Main Server] Background workers, socket emitter, and socket server initialized.");

    httpServer.listen(port, '0.0.0.0', () => {
      clearTimeout(startupTimeout);
      console.log(`\x1b[32m[Main Server] Running at http://0.0.0.0:${port}\x1b[0m`);
      const { getAuthCookieOptions } = require('./utils/auth-utils');
      console.log(`\x1b[35m[Main Server] Auth Cookie httpOnly: ${getAuthCookieOptions().httpOnly}\x1b[0m`);
      console.log(`\x1b[32m[Main Server] Server is READY for requests\x1b[0m`);
    });
  } catch (err) {
    clearTimeout(startupTimeout);
    console.error("[Main Server] FATAL: Startup failed:", err);
    process.exit(1);
  }
}

startServer();
