import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { config } from './config/index';
import { logger, correlationIdMiddleware, getCorrelationId } from './lib/logger';
import { mountSwaggerUI } from '@wapi/contracts';
import { openapiDocument } from './openapi';

import { startBillingEventConsumer } from './events/EventBus';
import walletRoutes from './routes/walletRoutes';
import webhookRoutes from './routes/webhookRoutes';
import commerceRoutes from './routes/commerceRoutes';
import { errorHandler } from './middleware/errorHandler';
import workspaceBillingRoutes from './routes/workspaceBillingRoutes';
import { createRedisConnection } from './lib/redis';
import { metricsEndpoint } from '@wapi/contracts';
import { billingMetrics } from './lib/metrics';

// --- Startup Guards ---
// ... (omitted)

const app = express();
const backgroundWorkersEnabled = process.env.ENABLE_BACKGROUND_WORKERS !== 'false';
let ready = false;
let server: ReturnType<typeof app.listen> | null = null;
const readinessRedis = createRedisConnection('billing-readiness', { lazyConnect: true, maxRetriesPerRequest: 1 });
app.use(helmet());
app.use(cors());
app.use(express.json({
  verify: (req: any, _res, buf) => {
    if (req.originalUrl.includes('/webhooks/razorpay')) {
      req.rawBody = buf;
    }
  }
}));

app.use(correlationIdMiddleware);
app.use(billingMetrics.middleware());

// Request Logger — structured, correlated, ships to Better Stack via shared logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info('http.request', {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - start,
      correlationId: getCorrelationId(),
    });
  });
  next();
});

// API Docs — Swagger UI at /docs, raw spec at /docs/openapi.json
mountSwaggerUI(app, openapiDocument);

app.use('/api/billing/wallets', walletRoutes);
app.use('/api/billing/webhooks', webhookRoutes);
app.use('/api/billing/commerce', commerceRoutes);
app.use('/api/v1/commerce', commerceRoutes);

// Workspace-scoped billing routes — the API gateway strips /api/v1/workspace/billing
// before forwarding, so this service receives the sub-path (/, /plan, /info, etc.)
app.use('/', workspaceBillingRoutes);

// Global Error Handler
app.use(errorHandler);

app.get('/health', async (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = dbState === 1 ? 'connected' : dbState === 2 ? 'connecting' : 'disconnected';
  res.json({
    status: dbState === 1 ? 'ok' : 'degraded',
    service: 'billing-service',
    db: dbStatus,
    timestamp: new Date().toISOString()
  });
});
app.get('/readiness', async (_req, res) => {
  const dbReady = mongoose.connection.readyState === 1;
  let redisReady = false;
  try {
    if (readinessRedis.status === 'wait') await readinessRedis.connect();
    redisReady = (await readinessRedis.ping()) === 'PONG';
  } catch { redisReady = false; }
  const isReady = ready && dbReady && (!backgroundWorkersEnabled || redisReady);
  res.status(isReady ? 200 : 503).json({ status: isReady ? 'ready' : 'not_ready', mongo: dbReady, redis: redisReady });
});
app.get('/metrics', metricsEndpoint(billingMetrics));

async function bootstrap() {
  try {
    await mongoose.connect(config.mongodbUri);
    console.log('[Database] Connected to Billing Database');

    if (backgroundWorkersEnabled) {
      await startBillingEventConsumer();
    } else {
      console.log('[Billing Service] Background event consumer disabled for local development. Set ENABLE_BACKGROUND_WORKERS=true to enable it.');
    }

    server = app.listen(config.port, () => {
      ready = true;
      console.log(`[Billing Service] Listening on port ${config.port}`);
    });
  } catch (err: any) {
    console.error('[Bootstrap Error]', err.message);
    process.exit(1);
  }
}

bootstrap();

const shutdown = (signal: string) => {
  ready = false;
  server?.close(async () => {
    try { readinessRedis.disconnect(); } catch { /* noop */ }
    await mongoose.connection.close(false);
    console.log(`[Billing Service] ${signal} shutdown complete`);
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 45_000).unref();
};
process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
