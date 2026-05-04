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
import { authRateLimit, apiRateLimit, bulkRateLimit, exportRateLimit } from './middlewares/rateLimitMiddleware';
import authRoutes from './routes/authRoutes';
import contactRoutes from './routes/contactRoutes';
import messageRoutes from './routes/messageRoutes';
import conversationRoutes from './routes/conversationRoutes';
import commerceRoutes from './routes/commerceRoutes';
import proxyRoutes from './routes/proxyRoutes';
import adminRoutes from './routes/adminRoutes';
import webhookRoutes from './routes/webhookRoutes';
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
const port = parseInt(process.env.BACKEND_PORT || "3005", 10);

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
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// --- DATABASE ---
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("[Main Server] Connected to MongoDB"))
  .catch(err => console.error("[Main Server] MongoDB connection error:", err));

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
const pubClient = new IORedis(redisUrl, { maxRetriesPerRequest: null });
const subClient = pubClient.duplicate();
io.adapter(createAdapter(pubClient, subClient));

// Set IO instance for services
setIO(io);

// --- WORKERS & EMITTERS ---
initWorkers();
initSocketEmitter();
console.log("[Main Server] Background workers and socket emitter initialized.");

// --- ROUTES ---
import crmRoutes from './routes/crmRoutes';

import developerRoutes from './routes/developerRoutes';

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
app.use('/api/v1', proxyRoutes); // Handles /api/v1/automation, /api/v1/campaign, etc.
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

// Porting API routes will go here
// app.use('/api/v1/auth', authRoutes);
// app.use('/api/v1/messaging', messagingRoutes);

// --- ERROR HANDLING ---
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';

app.use(notFoundHandler);

app.use(errorHandler);

// --- START SERVER ---
httpServer.listen(port, () => {
  console.log(`\x1b[32m[Main Server] Running at http://127.0.0.1:${port}\x1b[0m`);
  console.log(`\x1b[36m[Main Server] Socket.io initialized with origins: ${allowedOrigins.join(', ')}\x1b[0m`);
  const { getAuthCookieOptions } = require('./utils/auth-utils');
  console.log(`\x1b[35m[Main Server] Auth Cookie httpOnly: ${getAuthCookieOptions().httpOnly}\x1b[0m`);
});

// --- SOCKET HANDLERS (Migrated from server.js) ---
import { handleSocketEvents, socketAuthMiddleware } from './sockets/socketHandler';

io.use(socketAuthMiddleware);

io.on("connection", (socket) => {
  handleSocketEvents(io, socket);
});
