import config from './config/index.js';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { connectDb } from './config/db.js';
import apiRouter from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import mongoose from 'mongoose';
import { createServiceLogger, correlationIdMiddleware, MetricsRegistry, metricsEndpoint } from '@wapi/contracts';

const app = express();
let ready = false;
let server: ReturnType<typeof app.listen> | null = null;
const metrics = new MetricsRegistry('contact-service');
const observability = createServiceLogger({ service: 'contact-service' });

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

// Global Error Handler
app.use(errorHandler);

// Health check endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'wapi-contact-service' });
});
app.get('/readiness', (_req, res) => {
  const isReady = ready && mongoose.connection.readyState === 1;
  res.status(isReady ? 200 : 503).json({ status: isReady ? 'ready' : 'not_ready', mongo: mongoose.connection.readyState === 1 });
});
app.get('/metrics', metricsEndpoint(metrics));

app.get('/', (req, res) => {
  res.json({ service: 'wapi-contact-service', healthy: true });
});

async function start() {
  await connectDb();
  server = app.listen(config.port, '0.0.0.0', () => {
    ready = true;
    console.log(`[Contact Service] Running at http://localhost:${config.port}`);
  });
}

start();
const shutdown = (signal: string) => {
  ready = false;
  server?.close(async () => {
    await mongoose.connection.close(false);
    console.log(`[Contact Service] ${signal} shutdown complete`);
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 45_000).unref();
};
process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
export default app;
