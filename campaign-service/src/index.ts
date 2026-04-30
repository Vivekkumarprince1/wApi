import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';

// Route Imports
import campaignRoutes from './routes/campaignRoutes';
import segmentRoutes from './routes/segmentRoutes';
import { CampaignWorker } from './workers/CampaignWorker';

dotenv.config();

// Initialize Background Worker
new CampaignWorker();

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Request Logger
app.use((req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || 'system';
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${correlationId}] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// Database Connection
const MONGODB_URI = process.env.MONGODB_URI_CAMPAIGN || 'mongodb://localhost:27017/wa_campaigns';

mongoose.connect(MONGODB_URI, {
  family: 4,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  maxPoolSize: 10,
})
  .then(() => console.log('Connected to Campaign Database'))
  .catch((err) => console.error('Database connection error:', err));

// Register Routes
app.use('/api/campaign-proxy', campaignRoutes);
app.use('/api/campaign-proxy', segmentRoutes);

// Health Check
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

// Start Server
const server = app.listen(PORT, () => {
  console.log(`Campaign Service listening on port ${PORT}`);
});

// Graceful Shutdown
function gracefulShutdown(signal: string) {
  console.log(`[${signal}] Received. Shutting down gracefully...`);
  server.close(async () => {
    console.log('HTTP server closed.');
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
