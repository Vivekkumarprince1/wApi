import config from './config/index.js';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { connectDb } from './config/db.js';
import { initEventBus, simulatedMode } from './services/eventBus.js';
import { startSnoozeWorker, stopSnoozeWorker } from './services/snooze-worker.js';
import apiRouter from './routes/index.js';
import internalRouter from './routes/internalRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import mongoose from 'mongoose';
import { createServiceLogger, correlationIdMiddleware, MetricsRegistry, metricsEndpoint } from '@wapi/contracts';

const app = express();
const backgroundWorkersEnabled = process.env.ENABLE_BACKGROUND_WORKERS !== 'false';
const metrics = new MetricsRegistry('chat-service');
const observability = createServiceLogger({ service: 'chat-service' });

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(correlationIdMiddleware(observability.withCorrelationId, observability.als));
app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));
app.use(metrics.middleware());
app.use((req, res, next) => {
  const started = Date.now();
  res.on('finish', () => observability.logger.info('http.request', { operation: 'http.request', method: req.method, path: req.path, statusCode: res.statusCode, durationMs: Date.now() - started, workspaceId: (req as any).workspace?.id, userId: (req as any).user?.id, result: res.statusCode < 400 ? 'success' : 'failure' }));
  next();
});

// Mount aggregated API Router
app.use('/', apiRouter);
// Mount Internal Service Bridge Router
app.use('/api/internal', internalRouter);

// Global Error Handler
app.use(errorHandler);


// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'wapi-chat-service', simulatedMode });
});
app.get('/readiness', (_req, res) => {
  const mongoReady = mongoose.connection.readyState === 1;
  const isReady = mongoReady && (!backgroundWorkersEnabled || !simulatedMode);
  res.status(isReady ? 200 : 503).json({ status: isReady ? 'ready' : 'not_ready', mongo: mongoReady, eventBus: !simulatedMode });
});
app.get('/metrics', metricsEndpoint(metrics));

app.get('/', (req, res) => {
  res.json({ service: 'wapi-chat-service', healthy: true });
});

async function start() {
  await connectDb();
  if (backgroundWorkersEnabled) {
    await initEventBus();
    startSnoozeWorker();
  } else {
    console.warn('[Chat Service] Background workers disabled; HTTP API remains available.');
  }

  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`[Chat Service] Running at http://localhost:${config.port}`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('[Chat Service] SIGTERM — shutting down gracefully...');
    stopSnoozeWorker();
    server.close(() => process.exit(0));
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

start();
export default app;
