import config from './config/index.js';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { connectDb } from './config/db.js';
import apiRouter from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { disconnectEventProducer, startAuditConsumer, startBillingPlanConsumer, stopAuditConsumer, stopBillingPlanConsumer } from './services/eventService.js';
import { startDeletionWorker, stopDeletionQueue } from './services/deletion-queue.js';
import mongoose from 'mongoose';
import { createServiceLogger, correlationIdMiddleware, MetricsRegistry, metricsEndpoint } from '@wapi/contracts';

const app = express();
const metrics = new MetricsRegistry('auth-service');
const observability = createServiceLogger({ service: 'auth-service' });

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3100",
  "http://127.0.0.1:3100"
];
const corsOrigin = allowedOrigins.includes('*') ? true : allowedOrigins;
app.use(cors({
  origin: (origin, callback) => {
    if (corsOrigin === true || !origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(correlationIdMiddleware(observability.withCorrelationId, observability.als));
app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));
app.use(metrics.middleware());
app.use((req, res, next) => {
  const started = Date.now();
  res.on('finish', () => observability.logger.info('http.request', { operation: 'http.request', method: req.method, path: req.path, statusCode: res.statusCode, durationMs: Date.now() - started, result: res.statusCode < 400 ? 'success' : 'failure' }));
  next();
});

// Mount API Router
app.use('/', apiRouter);

// Global Error Handler
app.use(errorHandler);

// Health check endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'wapi-auth-service' });
});
app.get('/readiness', (_req, res) => {
  const isReady = mongoose.connection.readyState === 1;
  res.status(isReady ? 200 : 503).json({ status: isReady ? 'ready' : 'not_ready', mongo: isReady });
});
app.get('/metrics', metricsEndpoint(metrics));

app.get('/', (req, res) => {
  res.json({ service: 'wapi-auth-service', healthy: true });
});

async function start() {
  await connectDb();

  // Start EventBus audit consumer (persists audit events → auditlogs collection)
  await startAuditConsumer();
  await startBillingPlanConsumer();
  await startDeletionWorker();

  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`[Auth Service] Running at http://localhost:${config.port}`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('[Auth Service] SIGTERM received — shutting down gracefully...');
    await disconnectEventProducer();
    await stopAuditConsumer();
    await stopBillingPlanConsumer();
    await stopDeletionQueue();
    server.close(() => process.exit(0));
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

start();
// Export app for testing and gateway use
export default app;
