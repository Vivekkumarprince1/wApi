import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { config } from './config/index';
import { logger, correlationIdMiddleware, getCorrelationId } from './lib/logger';
import { mountSwaggerUI } from '@connectsphere/contracts';
import { openapiDocument } from './openapi';

import { startBillingEventConsumer } from './events/EventBus';
import walletRoutes from './routes/walletRoutes';
import webhookRoutes from './routes/webhookRoutes';
import commerceRoutes from './routes/commerceRoutes';
import { errorHandler } from './middleware/errorHandler';
import workspaceBillingRoutes from './routes/workspaceBillingRoutes';

// --- Startup Guards ---
// ... (omitted)

const app = express();
const backgroundWorkersEnabled = process.env.ENABLE_BACKGROUND_WORKERS !== 'false';
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

async function bootstrap() {
  try {
    await mongoose.connect(config.mongodbUri);
    console.log('[Database] Connected to Billing Database');

    if (backgroundWorkersEnabled) {
      await startBillingEventConsumer();
    } else {
      console.log('[Billing Service] Background event consumer disabled for local development. Set ENABLE_BACKGROUND_WORKERS=true to enable it.');
    }

    app.listen(config.port, () => {
      console.log(`[Billing Service] Listening on port ${config.port}`);
    });
  } catch (err: any) {
    console.error('[Bootstrap Error]', err.message);
    process.exit(1);
  }
}

bootstrap();
