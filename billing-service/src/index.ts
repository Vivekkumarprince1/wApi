import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { config } from './config/index';

import './events/EventBus'; // Initialize worker
import walletRoutes from './routes/walletRoutes';
import webhookRoutes from './routes/webhookRoutes';

// --- Startup Guards ---
if (!config.razorpayKeyId || !config.razorpayKeySecret) {
  console.warn('[Billing Service] WARNING: Razorpay credentials not configured. Payment features will fail.');
}

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

app.use('/api/billing/wallets', walletRoutes);
app.use('/api/billing/webhooks', webhookRoutes);

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

