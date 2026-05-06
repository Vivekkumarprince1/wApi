import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';

// Route Imports
import aiIntentRoutes from './routes/aiIntentRoutes';
import answerBotRoutes from './routes/answerBotRoutes';
import engineRoutes from './routes/engineRoutes';
import interaktiveListRoutes from './routes/interaktiveListRoutes';
import instagramQuickflowRoutes from './routes/instagramQuickflowRoutes';
import whatsappFormRoutes from './routes/whatsappFormRoutes';

const app = express();
const PORT = process.env.PORT || 3001;

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
    console.log(`[Automation Service][${correlationId}] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// Database Connection
const MONGODB_URI = process.env.MONGODB_URI_AUTOMATION || 'mongodb://localhost:27017/wapi_automation';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to Automation Database'))
  .catch((err) => console.error('Database connection error:', err));

// Register Routes
// Standardize: mount everything under /api/automation/engine
app.use('/api/automation/engine', aiIntentRoutes);
app.use('/api/automation/engine', answerBotRoutes);
app.use('/api/automation/engine', engineRoutes);
app.use('/api/automation/engine', interaktiveListRoutes);
app.use('/api/automation/engine', instagramQuickflowRoutes);
app.use('/api/automation/engine', whatsappFormRoutes);

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

// Start Server
const server = app.listen(PORT, () => {
  console.log(`Automation Service listening on port ${PORT}`);
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

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
