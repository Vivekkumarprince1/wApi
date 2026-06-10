import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import { logger, correlationIdMiddleware, getCorrelationId } from './lib/logger';
import { mountSwaggerUI } from '@wapi/contracts';
import { openapiDocument } from './openapi';

// Route Imports
import aiIntentRoutes from './routes/aiIntentRoutes';
import answerBotRoutes from './routes/answerBotRoutes';
import engineRoutes from './routes/engineRoutes';
import interaktiveListRoutes from './routes/interaktiveListRoutes';
import instagramQuickflowRoutes from './routes/instagramQuickflowRoutes';
import whatsappFormRoutes from './routes/whatsappFormRoutes';
import flowRoutes from './routes/flowRoutes';
import widgetRoutes from './routes/widgetRoutes';
import developerRoutes from './routes/developerRoutes';
import integrationRoutes from './routes/integrationRoutes';
import { startIntegrationSyncScheduler, stopIntegrationSyncScheduler } from './services/integration-sync-scheduler';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
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

// Database Connection
const MONGODB_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI_AUTOMATION ||
  process.env.MONGODB_URI ||
  'mongodb://localhost:27017/wapi_automation';

// API Docs — Swagger UI at /docs, raw spec at /docs/openapi.json
mountSwaggerUI(app, openapiDocument);

// Register Routes
app.use('/api/automation/engine', aiIntentRoutes);
app.use('/api/automation/engine', answerBotRoutes);
app.use('/api/automation/engine', engineRoutes);
app.use('/api/automation/engine', interaktiveListRoutes);
app.use('/api/automation/engine', instagramQuickflowRoutes);
app.use('/api/automation/engine', whatsappFormRoutes);

// Decoupled Monolith Restored Routes (mounting at root as paths handle aliases natively)
app.use('/', flowRoutes);
app.use('/', widgetRoutes);
app.use('/', developerRoutes);
app.use('/', integrationRoutes);


// Health Check
app.get('/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = dbState === 1 ? 'connected' : dbState === 2 ? 'connecting' : 'disconnected';
  res.json({
    status: dbState === 1 ? 'ok' : 'degraded',
    service: 'automation-service',
    db: dbStatus,
    timestamp: new Date()
  });
});

// Start Server (await Mongo first so HTTP traffic can't hit a disconnected DB).
let server: ReturnType<typeof app.listen> | null = null;

(async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to Automation Database');
    server = app.listen(PORT, () => {
      console.log(`Automation Service listening on port ${PORT}`);
    });

    // Start the time-based scheduler once the DB is ready. Without this
    // any AutomationRule whose `trigger.event === 'schedule'` would never
    // fire — there was no cron in this service before.
    try {
      const { startScheduler } = await import('./workers/scheduler');
      await startScheduler();
    } catch (err: any) {
      console.error('Scheduler failed to start:', err?.message);
    }

    // Start integration sync background jobs (Google Sheets, Petpooja)
    startIntegrationSyncScheduler();
  } catch (err) {
    console.error('FATAL: Database connection error during startup:', err);
    process.exit(1);
  }
})();

// Graceful Shutdown
function gracefulShutdown(signal: string) {
  console.log(`[${signal}] Received. Shutting down gracefully...`);
  const closeServer = (): Promise<void> =>
    new Promise((resolve) => {
      if (!server) return resolve();
      server.close(() => resolve());
    });

  closeServer().then(async () => {
    console.log('HTTP server closed.');
    stopIntegrationSyncScheduler();
    try {
      await mongoose.connection.close(false);
      console.log('Database connection closed.');
      process.exit(0);
    } catch (err) {
      console.error('Error during database disconnection:', err);
      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
