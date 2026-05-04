import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';

// Route Imports
import campaignRoutes from './routes/campaignRoutes';
import segmentRoutes from './routes/segmentRoutes';
import { CampaignWorker } from './workers/CampaignWorker';

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
    console.log(`[Campaign Service][${correlationId}] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// Database Connection
const MONGODB_URI = process.env.MONGODB_URI_CAMPAIGN || 'mongodb://localhost:27017/wa_campaigns';

let server: any;

console.log('⏳ Connecting to MongoDB Atlas...');

mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 15000,
  socketTimeoutMS: 45000,
  maxPoolSize: 10,
})
  .then(() => {
    console.log('✅ Connected to Campaign Database');
    // Initialize Background Worker ONLY after DB connection
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

// Register Routes
app.use('/api/campaign', campaignRoutes);
app.use('/api/campaign', segmentRoutes);

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
