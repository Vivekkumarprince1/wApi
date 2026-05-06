import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { config } from './config/index';

import './events/EventBus'; // Initialize worker
import walletRoutes from './routes/walletRoutes';
import webhookRoutes from './routes/webhookRoutes';
import commerceRoutes from './routes/commerceRoutes';

// --- Startup Guards ---
// ... (omitted)

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({
  verify: (req: any, _res, buf) => {
    if (req.originalUrl.includes('/webhooks/razorpay')) {
      req.rawBody = buf;
    }
  }
}));

// Request Logger
app.use((req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || 'system';
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[Billing Service][${correlationId}] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

app.use('/api/billing/wallets', walletRoutes);
app.use('/api/billing/webhooks', webhookRoutes);
app.use('/api/billing/commerce', commerceRoutes);

app.get('/health', async (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = dbState === 1 ? 'connected' : dbState === 2 ? 'connecting' : 'disconnected';
  res.json({
    status: dbState === 1 ? 'ok' : 'degraded',
    service: 'billing-service',
    db: dbStatus,
    timestamp: new Date().toISOString()
  });
});

async function bootstrap() {
  try {
    await mongoose.connect(config.mongodbUri);
    console.log('[Database] Connected to Billing Database');

    app.listen(config.port, () => {
      console.log(`[Billing Service] Listening on port ${config.port}`);
    });
  } catch (err: any) {
    console.error('[Bootstrap Error]', err.message);
    process.exit(1);
  }
}

bootstrap();

