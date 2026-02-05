const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
let mongod = null;
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { initSocket } = require('./utils/socket');
const { connectRedis } = require('./config/redis');
const { mongoUri, port, env } = require('./config');
const errorHandler = require('./middlewares/errorHandler');
const { enforceTenantIsolation } = require('./middlewares/bspTenantRouter');

const BSP_ONLY = process.env.BSP_ONLY !== 'false';

// Routes
const authRoutes = require('./routes/authRoutes');
const contactRoutes = require('./routes/contactRoutes');
const messageRoutes = require('./routes/messageRoutes');
const webhookRoutes = require('./routes/webhookRoutes');

const app = express();
const server = http.createServer(app);

app.set("trust proxy", ['loopback', 'linklocal', 'uniquelocal']);


// Basic security and CORS
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      baseUri: ["'none'"],
      frameAncestors: ["'none'"],
      formAction: ["'none'"],
      connectSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"]
    }
  },
  crossOriginResourcePolicy: { policy: 'same-site' }
}));

// CORS configuration - allow frontend with credentials
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://waapi-frontend.onrender.com'
];

// Add FRONTEND_URL from env if set
if (process.env.FRONTEND_URL && process.env.FRONTEND_URL !== '*') {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
};

console.log('🌐 CORS enabled for origins:', allowedOrigins);

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Enable preflight for all routes

// Rate limiting (apply to API routes)
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use('/api/', (req, res, next) => {
  if (req.path.startsWith('/v1/webhook')) return next();
  return limiter(req, res, next);
});


// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
if (env === 'development') app.use(morgan('dev'));

// Import init service
const { initializeDefaultWABA } = require('./services/initService');

// Connect to MongoDB (supports in-memory for local dev)
async function startDB() {
  if (process.env.USE_IN_MEMORY_DB === 'true') {
    // Lazy require to keep prod bundle clean
    const { MongoMemoryServer } = require('mongodb-memory-server');
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
    console.log('Connected to in-memory MongoDB');
  } else {
    try {
      await mongoose.connect(mongoUri);
      console.log('MongoDB connected');
      
      // Initialize WABA credentials for workspaces after DB connection
      await initializeDefaultWABA();
    } catch (err) {
      console.error('MongoDB connection error:', err);
    }
  }
}
startDB().catch((e) => console.error('DB start failed', e));

// Connect to Redis (for queues and caching)
let redisConnection = null;
connectRedis().then(conn => {
  redisConnection = conn;
  console.log('[Server] Redis connected - initializing queues');
  
  // Initialize webhook queue
  try {
    const { initializeWebhookQueue, startWebhookWorker } = require('./services/webhookQueue');
    initializeWebhookQueue(redisConnection);
    
    if (process.env.START_WEBHOOK_WORKER === 'true') {
      startWebhookWorker(redisConnection);
      console.log('[Server] ✅ Webhook worker started');
    }
  } catch (err) {
    console.error('[Server] Failed to initialize webhook queue:', err.message);
  }

  // Initialize message retry queue (Week 2 addition)
  try {
    const { initializeMessageRetryQueue, startMessageRetryWorker } = require('./services/messageRetryQueue');
    initializeMessageRetryQueue(redisConnection);
    
    if (process.env.START_MESSAGE_RETRY_WORKER === 'true') {
      startMessageRetryWorker(redisConnection);
      console.log('[Server] ✅ Message retry worker started');
    }
  } catch (err) {
    console.error('[Server] Failed to initialize message retry queue:', err.message);
  }
}).catch((err) => console.warn('Redis connection failed, queues unavailable:', err));

// Start token refresh cron (Week 2 addition)
try {
  const tokenRefreshCron = require('./services/tokenRefreshCron');
  tokenRefreshCron.start();
  console.log('[Server] ✅ Token refresh cron started (every 6 hours)');
} catch (err) {
  console.error('[Server] Failed to start token refresh cron:', err.message);
}

// Start Usage Ledger nightly snapshot (BSP billing)
try {
  const usageLedgerCron = require('./services/usageLedgerCron');
  usageLedgerCron.start();
  console.log('[Server] ✅ Usage ledger cron started (daily)');
} catch (err) {
  console.error('[Server] Failed to start usage ledger cron:', err.message);
}

// Start WABA autosync service (Stage 1 hardening)
if (process.env.START_WABA_AUTOSYNC !== 'false') {
  try {
    const { startAutosync } = require('./services/wabaAutosyncService');
    startAutosync();
    console.log('[Server] ✅ WABA autosync service started');
  } catch (err) {
    console.error('[Server] Failed to start WABA autosync:', err.message);
  }
}

// Initialize socket.io
initSocket(server);

// Mount core routes
app.use('/api/v1', enforceTenantIsolation);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/contacts', contactRoutes);
app.use('/api/v1/messages', messageRoutes);
app.use('/api/v1/webhook', webhookRoutes);

// Additional modules
const campaignRoutes = require('./routes/campaignRoutes');
const adsRoutes = require('./routes/adsRoutes');
const automationRoutes = require('./routes/automationRoutes');
const autoReplyRoutes = require('./routes/autoReplyRoutes');
const instagramQuickflowRoutes = require('./routes/instagramQuickflowRoutes');
const whatsappFormRoutes = require('./routes/whatsappFormRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const billingRoutes = require('./routes/billingRoutes'); // Week 2 addition
const templateRoutes = require('./routes/templateRoutes');
const messagingRoutes = require('./routes/messagingRoutes'); // Template sending (Interakt-style)
const conversationRoutes = require('./routes/conversationRoutes');
const inboxRoutes = require('./routes/inboxRoutes'); // Stage 4: Shared Inbox
const internalNotesRoutes = require('./routes/internalNotesRoutes'); // Stage 4 Hardening: Internal Notes
const metricsRoutes = require('./routes/metricsRoutes');
const onboardingRoutes = require('./routes/onboardingRoutes');
const bspOnboardingRoutes = require('./routes/bspOnboardingRoutes'); // BSP Interakt model
const adminRoutes = require('./routes/adminRoutes');
const bspAdminRoutes = require('./routes/bspAdminRoutes'); // BSP multi-tenant admin
const internalRoutes = require('./routes/internalRoutes'); // Internal BSP health
const usageRoutes = require('./routes/usageRoutes');
const dealRoutes = require('./routes/dealRoutes');
const pipelineRoutes = require('./routes/pipelineRoutes');
const reportsRoutes = require('./routes/reportsRoutes');
const productRoutes = require('./routes/productRoutes');
const checkoutBotRoutes = require('./routes/checkoutBotRoutes');
const integrationsRoutes = require('./routes/integrationsRoutes');
const widgetRoutes = require('./routes/widgetRoutes');
const dataDeletionRoutes = require('./routes/dataDeletionRoutes');
const billingReportsRoutes = require('./routes/billingReportsRoutes'); // Stage 5: Billing Reports
const tagRoutes = require('./routes/tagRoutes'); // Stage 5: CRM Tags
const analyticsDashboardRoutes = require('./routes/analyticsDashboardRoutes'); // Stage 5: Analytics Dashboard
const automationEngineRoutes = require('./routes/automationEngineRoutes'); // Stage 6: Automation Engine
const auditRoutes = require('./routes/auditRoutes'); // Stage 5: Audit Logs

app.use('/api/v1/campaigns', campaignRoutes);
app.use('/api/v1/ads', adsRoutes);
app.use('/api/v1/automation', automationRoutes);
app.use('/api/v1/auto-replies', autoReplyRoutes);
app.use('/api/v1/instagram-quickflows', instagramQuickflowRoutes);
app.use('/api/v1/whatsapp-forms', whatsappFormRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/billing', billingRoutes); // Week 2 addition
app.use('/api/v1/templates', templateRoutes);
app.use('/api/v1/messages', messagingRoutes); // Template sending (Interakt-style)
app.use('/api/v1/conversations', conversationRoutes);
app.use('/api/v1/inbox', inboxRoutes); // Stage 4: Shared Inbox
app.use('/api/v1/inbox', internalNotesRoutes); // Stage 4 Hardening: Internal Notes
app.use('/api/v1/metrics', metricsRoutes);
app.use('/api/v1/onboarding', onboardingRoutes);
// Alias (no version prefix) for Embedded Signup start/callback
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/v1/onboarding/bsp', bspOnboardingRoutes); // BSP Interakt model
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/admin/bsp', bspAdminRoutes); // BSP multi-tenant admin
app.use('/internal', internalRoutes);
app.use('/api/v1/usage', usageRoutes);
app.use('/api/v1/sales/deals', dealRoutes);
app.use('/api/v1/sales/pipelines', pipelineRoutes);
app.use('/api/v1/sales/reports', reportsRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/checkout-bot', checkoutBotRoutes);
app.use('/api/v1/integrations', integrationsRoutes);
app.use('/api/v1/widget', widgetRoutes);
app.use('/api/v1/privacy', dataDeletionRoutes);
app.use('/api/v1/reports', billingReportsRoutes); // Stage 5: Billing Reports
app.use('/api/v1/tags', tagRoutes); // Stage 5: CRM Tags
app.use('/api/v1/analytics/dashboard', analyticsDashboardRoutes); // Stage 5: Analytics Dashboard
app.use('/api/v1/automation/engine', automationEngineRoutes); // Stage 6: Automation Engine
app.use('/api/v1/audit-logs', auditRoutes); // Stage 5: Audit Logs

// Start Automation Engine (Stage 6)
if (process.env.ENABLE_AUTOMATION_ENGINE !== 'false') {
  try {
    const { startEngine } = require('./services/automationEngine');
    startEngine();
    console.log('[Server] ✅ Automation engine started');
  } catch (err) {
    console.error('[Server] Failed to start automation engine:', err.message);
  }
}

// Root - redirect to health for a friendly default
app.get('/', (req, res) => res.redirect('/api/v1/health'));

// Health
app.get('/api/v1/health', (req, res) => res.json({ status: 'ok', env }));

// Error handler
app.use(errorHandler);

// 404
app.use('*', (req, res) => res.status(404).json({ success: false, message: 'Not Found' }));

const serverPort = port || 5000;
server.listen(serverPort, () => console.log(`Server running on port http://localhost:${serverPort}`));

// Optionally start the worker from the same process during development (recommended to run separately in prod)
if (process.env.START_WORKER === 'true') {
  const { runWorker, scheduleCartExpiryCleanup } = require('./services/queueWorker');
  runWorker().catch((err) => console.error('Worker failed:', err));
  scheduleCartExpiryCleanup().catch((err) => console.error('Cart expiry scheduler failed:', err));
  
  // ✅ Initialize workflow worker
  const { initWorkflowWorker } = require('./services/workflowExecutionService');
  initWorkflowWorker();
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAGE 3: Campaign Scheduler
// Checks for scheduled campaigns and starts them at the specified time
// ═══════════════════════════════════════════════════════════════════════════════
if (process.env.START_CAMPAIGN_SCHEDULER !== 'false') {
  try {
    const { startScheduler } = require('./services/campaignSchedulerService');
    startScheduler();
    console.log('[Server] ✅ Campaign scheduler started');
  } catch (err) {
    console.error('[Server] Failed to start campaign scheduler:', err.message);
  }
}

// Simple analytics cron (daily) - can be expanded to a separate worker/cron service
if (process.env.START_ANALYTICS_CRON === 'true') {
  const cron = require('node-cron');
  const { aggregateDailyStats } = require('./services/analyticsService');
  cron.schedule('0 0 * * *', () => {
    aggregateDailyStats().catch((e) => console.error('Analytics cron failed', e));
  });
}

// Token refresh cron (daily) - refreshes ESB tokens before 60-day expiry
if (!BSP_ONLY && process.env.START_TOKEN_REFRESH_CRON === 'true') {
  const cron = require('node-cron');
  const metaAutomationService = require('./services/metaAutomationService');
  const { decrypt, encrypt, isEncrypted } = require('./utils/encryption');
  
  cron.schedule('0 2 * * *', async () => { // 2 AM UTC daily
    try {
      const Workspace = require('./models/Workspace');
      
      // Find workspaces with tokens expiring within 7 days
      const workspaces = await Workspace.find({
        'esbFlow.tokenExpiry': { 
          $lt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Within 7 days
          $gt: new Date() // But still valid
        },
        'esbFlow.userRefreshToken': { $exists: true, $ne: null },
        'esbFlow.status': 'completed'
      });
      
      console.log(`[Token Refresh] Found ${workspaces.length} workspaces with tokens expiring within 7 days`);
      
      for (const workspace of workspaces) {
        try {
          const workspaceId = workspace._id.toString();
          
          // Decrypt refresh token
          let refreshToken = workspace.esbFlow.userRefreshToken;
          if (isEncrypted(refreshToken)) {
            refreshToken = decrypt(refreshToken, workspaceId);
          }
          
          if (!refreshToken) {
            console.warn(`[Token Refresh] No refresh token for workspace ${workspaceId}`);
            continue;
          }
          
          // Refresh the token
          const newToken = await metaAutomationService.refreshUserToken(refreshToken);
          
          // Update with encrypted tokens
          workspace.esbFlow.userAccessToken = encrypt(newToken.accessToken, workspaceId);
          workspace.esbFlow.userRefreshToken = encrypt(newToken.refreshToken || refreshToken, workspaceId);
          workspace.esbFlow.tokenExpiry = new Date(Date.now() + newToken.expiresIn * 1000);
          
          await workspace.save();
          console.log(`[Token Refresh] ✅ Token refreshed for workspace ${workspaceId}`);
        } catch (err) {
          console.error(`[Token Refresh] ❌ Failed to refresh token for workspace ${workspace._id}:`, err.message);
          
          // Mark workspace with refresh failure for admin alerts
          try {
            workspace.esbFlow.lastTokenRefreshError = err.message;
            workspace.esbFlow.lastTokenRefreshAttempt = new Date();
            await workspace.save();
          } catch (saveErr) {
            console.error('Failed to save refresh error:', saveErr.message);
          }
        }
      }
    } catch (err) {
      console.error('[Token Refresh] Cron job error:', err.message);
    }
  });
  
  console.log('[Server] ✅ Token refresh cron enabled (runs daily at 2 AM UTC)');
}

// BSP system token health monitor (Interakt-grade operational hardening)
if (process.env.START_BSP_HEALTH_MONITOR !== 'false') {
  try {
    const { startBspHealthMonitor } = require('./services/bspHealthService');
    startBspHealthMonitor();
    console.log('[Server] ✅ BSP health monitor started');
  } catch (err) {
    console.error('[Server] Failed to start BSP health monitor:', err.message);
  }
}

module.exports = server;

// Graceful shutdown for in-memory DB when process exits
process.on('SIGINT', async () => {
  try {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  } catch (e) {}
  process.exit(0);
});