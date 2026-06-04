import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import config from './config/index.js';
import { connectDb } from './config/db.js';
import { initKafka, simulatedMode } from './services/kafkaService.js';
import { startSnoozeWorker, stopSnoozeWorker } from './services/snooze-worker.js';
import apiRouter from './routes/index.js';
import internalRouter from './routes/internalRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));

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

app.get('/', (req, res) => {
  res.json({ service: 'wapi-chat-service', healthy: true });
});

async function start() {
  await connectDb();
  await initKafka();

  // Start in-process background workers
  startSnoozeWorker();

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
