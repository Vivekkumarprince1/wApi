import 'dotenv/config';

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import IORedis from 'ioredis';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import { setIO } from './services/socket-bridge';
import { initWorkers } from './services/worker-registry';
import { initSocketEmitter } from './services/socket-emitter';
import { authRateLimit, apiRateLimit, bulkRateLimit } from './middlewares/rateLimitMiddleware';
import { correlationIdMiddleware, logger } from './utils/logger';
import authRoutes from './routes/authRoutes';
import webhookRoutes from './routes/webhookRoutes';
import healthRoutes from './routes/healthRoutes';
import contactRoutes from './routes/contactRoutes';
import messageRoutes from './routes/messageRoutes';
import conversationRoutes from './routes/conversationRoutes';
import commerceRoutes from './routes/commerceRoutes';
import adminRoutes from './routes/adminRoutes';
import workspaceRoutes from './routes/workspaceRoutes';
import settingsRoutes from './routes/settingsRoutes';
import templateRoutes from './routes/templateRoutes';
import onboardingRoutes from './routes/onboardingRoutes';
import flowRoutes from './routes/flowRoutes';
import uploadRoutes from './routes/uploadRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import metricsRoutes from './routes/metricsRoutes';
import integrationRoutes from './routes/integrationRoutes';
import adsRoutes from './routes/adsRoutes';
import supportRoutes from './routes/supportRoutes';
import widgetRoutes from './routes/widgetRoutes';
import bulkOperationsRoutes from './routes/bulkOperationsRoutes';
import internalRoutes from './routes/internalRoutes';
import compatRoutes from './routes/compatRoutes';

// --- STARTUP GUARDS ---
const requiredEnv = ['JWT_SECRET', 'MONGODB_URI', 'REDIS_URL', 'INTERNAL_SERVICE_SECRET'];
const missingEnv = requiredEnv.filter(key => !process.env[key]);

if (missingEnv.length > 0) {
  console.error(`\x1b[41m\x1b[37m FATAL: Missing required environment variables: ${missingEnv.join(', ')} \x1b[0m`);
  process.exit(1);
}

if (process.env.INTERNAL_SERVICE_SECRET === 'your-service-secret') {
  console.warn("\x1b[33m[Main Server] WARNING: Using default INTERNAL_SERVICE_SECRET. Change this for production.\x1b[0m");
}

const app = express();
const port = parseInt(process.env.BACKEND_PORT || process.env.PORT || "5001", 10);
console.log(`[Main Server] Configured port: ${port} (BACKEND_PORT=${process.env.BACKEND_PORT}, PORT=${process.env.PORT})`);

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001"
];

// --- MIDDLEWARES ---
app.use(helmet());
app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
  credentials: true
}));
// Stamp every request with an x-correlation-id (echoed on response) so
// logs/jobs/cross-service calls can be traced as a single flow.
app.use(correlationIdMiddleware);
// Verbose dev-style logs only in development. Use 'combined' in
// production for proxy-friendly access logs.
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({
  verify: (req: any, res, buf) => {
    req.rawBody = buf.toString();
  }
}));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// --- DATABASE ---
// Connect is awaited inside startServer() below, before httpServer.listen().
// Mongoose buffering is disabled there to surface "DB not connected" errors
// instead of silently queueing operations.

// --- SOCKET.IO ---
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

// Redis Adapter
const redisUrl = process.env.REDIS_URL;
const pubClient = new IORedis(redisUrl!, { maxRetriesPerRequest: null });
const subClient = pubClient.duplicate();
io.adapter(createAdapter(pubClient, subClient));

// Set IO instance for services
setIO(io);

// --- WORKERS & EMITTERS (initialized inside startServer once DB is ready) ---
import { MicroserviceEventBridge } from './services/microservice-event-bridge';

// --- ROUTES ---
import crmRoutes from './routes/crmRoutes';

import developerRoutes from './routes/developerRoutes';

import { proxyMiddleware } from './middlewares/proxyMiddleware';
import { authenticate } from './middlewares/authMiddleware';

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/super-admin', adminRoutes);
app.use('/api/v1/contacts', apiRateLimit, contactRoutes);
app.use('/api/v1/bulk', bulkRateLimit, bulkOperationsRoutes);
app.use('/api/v1/conversations', apiRateLimit, conversationRoutes);
app.use('/api/v1/workspace', apiRateLimit, workspaceRoutes);
app.use('/api/v1/settings', apiRateLimit, settingsRoutes);
app.use('/api/v1/developer', apiRateLimit, developerRoutes);
app.use('/api/v1/inbox', apiRateLimit, messageRoutes);
app.use('/api/v1/commerce', commerceRoutes);
app.use('/api/v1/crm', crmRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/health', healthRoutes);

// Microservice Proxies
app.use('/api/v1/automation', authenticate, proxyMiddleware.proxyTo('automation'));
app.use('/api/v1/campaign', authenticate, proxyMiddleware.proxyTo('campaign'));
app.use('/api/v1/billing', authenticate, proxyMiddleware.proxyTo('billing'));

app.use('/api/v1', compatRoutes);
app.use('/api/v1/templates', templateRoutes);
app.use('/api/v1/onboarding', onboardingRoutes);
app.use('/api/v1/flows', flowRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/metrics', metricsRoutes);
app.use('/api/v1/integrations', integrationRoutes);
app.use('/api/v1/ads', adsRoutes);
app.use('/api/v1/support', supportRoutes);
app.use('/api/v1/widget', widgetRoutes);
app.use('/api/internal', internalRoutes);

import { HealthService } from './services/health-service';

app.get('/health', async (req, res) => {
  const report = await HealthService.getFullReport();
  res.json(report);
});

// --- ROOT ENDPOINT (for tunnel connectivity verification) ---
// Localtunnel and other tunneling services test connectivity by making requests to /
// Must respond quickly with 200 OK
app.get('/', (req: express.Request, res: express.Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'wapi-server',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// --- ERROR HANDLING ---
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';

app.use(notFoundHandler);
app.use(errorHandler);

// --- SOCKET HANDLERS ---
import { handleSocketEvents, socketAuthMiddleware } from './sockets/socketHandler';

io.use(socketAuthMiddleware);
io.on("connection", (socket) => {
  handleSocketEvents(io, socket);
});

// --- START SERVER ---
async function startServer() {
  const startupTimeout = setTimeout(() => {
    console.warn("\x1b[33m[Main Server] WARNING: Startup taking longer than 20 seconds\x1b[0m");
    console.warn("\x1b[33m[Main Server] Check MongoDB and Redis connections\x1b[0m");
  }, 20000);

  try {
    // Disable buffering so DB ops fail fast if Mongo isn't ready instead
    // of queueing silently.
    mongoose.set('bufferCommands', false);
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log("[Main Server] Connected to MongoDB");

    initWorkers();
    initSocketEmitter();
    const eventBridge = new MicroserviceEventBridge(io);
    eventBridge.start().catch(err => console.error("[Main Server] Event Bridge failed to start:", err));
    console.log("[Main Server] Background workers, socket emitter, and event bridge initialized.");

    httpServer.listen(port, '0.0.0.0', () => {
      clearTimeout(startupTimeout);
      console.log(`\x1b[32m[Main Server] Running at http://0.0.0.0:${port}\x1b[0m`);
      console.log(`\x1b[36m[Main Server] Socket.io initialized with origins: ${allowedOrigins.join(', ')}\x1b[0m`);
      const { getAuthCookieOptions } = require('./utils/auth-utils');
      console.log(`\x1b[35m[Main Server] Auth Cookie httpOnly: ${getAuthCookieOptions().httpOnly}\x1b[0m`);
      console.log(`\x1b[32m[Main Server] Server is READY for requests\x1b[0m`);
    });
  } catch (err) {
    clearTimeout(startupTimeout);
    console.error("[Main Server] FATAL: Startup failed:", err);
    process.exit(1);
  }
}

startServer();
