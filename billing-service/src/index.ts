import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { config } from './config/index';

import './events/EventBus'; // Initialize worker
import walletRoutes from './routes/walletRoutes';
import webhookRoutes from './routes/webhookRoutes';
import commerceRoutes from './routes/commerceRoutes';
import { ensureRedisPolicy, redisClient } from './lib/redis';

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

// Liveness: process up, event loop responding
app.get('/live', (_req, res) => {
  res.json({ status: 'ok', service: 'billing-service', uptime: process.uptime() });
});

// Readiness: DB + Redis both reachable
app.get('/ready', async (_req, res) => {
  const dbOk = mongoose.connection.readyState === 1;
  let redisOk = false;
  try {
    const pong = await redisClient.ping();
    redisOk = pong === 'PONG';
  } catch {
    redisOk = false;
  }
  const ok = dbOk && redisOk;
  res.status(ok ? 200 : 503).json({
    status: ok ? 'ready' : 'not_ready',
    service: 'billing-service',
    db: dbOk ? 'ok' : 'down',
    redis: redisOk ? 'ok' : 'down',
  });
});

// Bare-bones Prometheus exposition (no extra deps).
app.get('/metrics', (_req, res) => {
  const mem = process.memoryUsage();
  const lines = [
    `# HELP process_uptime_seconds Process uptime`,
    `# TYPE process_uptime_seconds gauge`,
    `process_uptime_seconds ${process.uptime()}`,
    `# HELP process_resident_memory_bytes RSS memory`,
    `# TYPE process_resident_memory_bytes gauge`,
    `process_resident_memory_bytes ${mem.rss}`,
    `# HELP process_heap_used_bytes V8 heap used`,
    `# TYPE process_heap_used_bytes gauge`,
    `process_heap_used_bytes ${mem.heapUsed}`,
  ];
  res.type('text/plain').send(lines.join('\n') + '\n');
});

async function bootstrap() {
  try {
    await mongoose.connect(config.mongodbUri);
    console.log('[Database] Connected to Billing Database');

    await ensureRedisPolicy();

    app.listen(config.port, () => {
      console.log(`[Billing Service] Listening on port ${config.port}`);
    });
  } catch (err: any) {
    console.error('[Bootstrap Error]', err.message);
    process.exit(1);
  }
}

bootstrap();

