
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import { logger, correlationIdMiddleware, getCorrelationId } from './lib/logger';
import { mountSwaggerUI } from '@wapi/contracts';
import { openapiDocument } from './openapi';

// Route Imports
import campaignRoutes from './routes/campaignRoutes';
import segmentRoutes from './routes/segmentRoutes';
import adsRoutes from './routes/adsRoutes';
import { errorHandler } from './middleware/errorHandler';
import { CampaignWorker } from './workers/CampaignWorker';
import { startCampaignEventConsumer } from './lib/events/EventBus';


const app = express();
const PORT = process.env.PORT || 3002;

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
  process.env.MONGODB_URI_CAMPAIGN ||
  process.env.MONGODB_URI ||
  'mongodb://localhost:27017/wa_campaigns';

let server: any;

console.log('⏳ Connecting to MongoDB Atlas...');

mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 15000,
  socketTimeoutMS: 45000,
  maxPoolSize: 10,
})
  .then(() => {
    console.log('✅ Connected to Campaign Database');
    // Initialize Background Worker + Kafka event consumer ONLY after DB connection
    startCampaignEventConsumer()
      .then(() => console.log('✅ Campaign event consumer started'))
      .catch((err) => console.error('❌ Failed to start Kafka consumer:', err.message));
    
    new CampaignWorker();
    
    // Start Server ONLY after DB connection
    server = app.listen(PORT, () => {
      console.log(`🚀 Campaign Service listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Database connection error:');
    console.error(err.message);
    if (err.reason) console.error('Reason:', JSON.stringify(err.reason, null, 2));
    process.exit(1);
  });

// API Docs — Swagger UI at /docs, raw spec at /docs/openapi.json
mountSwaggerUI(app, openapiDocument);

// Health Check — MUST be registered before adsRoutes: it mounts parameterized
// paths like `/:id` at `/`, which would capture GET /health and 401 it.
app.get('/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = dbState === 1 ? 'connected' : dbState === 2 ? 'connecting' : 'disconnected';
  res.json({
    status: dbState === 1 ? 'ok' : 'degraded',
    service: 'campaign-service',
    db: dbStatus,
    timestamp: new Date()
  });
});

// Register Routes
app.use('/api/campaign', campaignRoutes);
app.use('/api/campaign', segmentRoutes);
app.use('/', adsRoutes);

// Global Error Handler
app.use(errorHandler);

// Graceful Shutdown
function gracefulShutdown(signal: string) {
  console.log(`[${signal}] Received. Shutting down gracefully...`);
  
  const closeDb = async () => {
    try {
      await mongoose.connection.close(false);
      console.log('Database connection closed.');
      process.exit(0);
    } catch (err: any) {
      console.error('Error during database disconnection:', err.message);
      process.exit(1);
    }
  };

  if (server) {
    server.close(async () => {
      console.log('HTTP server closed.');
      await closeDb();
    });
  } else {
    closeDb();
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
