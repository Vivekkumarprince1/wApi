import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import config from './config/index.js';
import { connectDb } from './config/db.js';
import apiRouter from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { disconnectKafkaProducer, startAuditConsumer, stopAuditConsumer } from './services/kafkaService.js';

const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3100",
  "http://127.0.0.1:3100"
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));

// Mount API Router
app.use('/', apiRouter);

// Global Error Handler
app.use(errorHandler);

// Health check endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'wapi-auth-service' });
});

app.get('/', (req, res) => {
  res.json({ service: 'wapi-auth-service', healthy: true });
});

async function start() {
  await connectDb();

  // Start Kafka audit consumer (persists audit events → auditlogs collection)
  await startAuditConsumer();

  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`[Auth Service] Running at http://localhost:${config.port}`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('[Auth Service] SIGTERM received — shutting down gracefully...');
    await disconnectKafkaProducer();
    await stopAuditConsumer();
    server.close(() => process.exit(0));
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

start();
// Export app for testing and gateway use
export default app;
