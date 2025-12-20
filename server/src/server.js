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

// Routes
const authRoutes = require('./routes/authRoutes');
const contactRoutes = require('./routes/contactRoutes');
const messageRoutes = require('./routes/messageRoutes');
const webhookRoutes = require('./routes/webhookRoutes');

const app = express();
const server = http.createServer(app);

app.set("trust proxy", ['loopback', 'linklocal', 'uniquelocal']);


// Basic security and CORS
app.use(helmet());

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
app.use('/api/', limiter);


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
connectRedis().catch((err) => console.warn('Redis connection failed', err));

// Initialize socket.io
initSocket(server);

// Mount core routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/contacts', contactRoutes);
app.use('/api/v1/messages', messageRoutes);
app.use('/api/v1/webhook', webhookRoutes);

// Additional modules
const campaignRoutes = require('./routes/campaignRoutes');
const automationRoutes = require('./routes/automationRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const templateRoutes = require('./routes/templateRoutes');
const conversationRoutes = require('./routes/conversationRoutes');
const metricsRoutes = require('./routes/metricsRoutes');
const onboardingRoutes = require('./routes/onboardingRoutes');
const adminRoutes = require('./routes/adminRoutes');

app.use('/api/v1/campaigns', campaignRoutes);
app.use('/api/v1/automation', automationRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/templates', templateRoutes);
app.use('/api/v1/conversations', conversationRoutes);
app.use('/api/v1/metrics', metricsRoutes);
app.use('/api/v1/onboarding', onboardingRoutes);
app.use('/api/v1/admin', adminRoutes);

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
  const { runWorker } = require('./services/queueWorker');
  runWorker().catch((err) => console.error('Worker failed:', err));
}

// Simple analytics cron (daily) - can be expanded to a separate worker/cron service
if (process.env.START_ANALYTICS_CRON === 'true') {
  const cron = require('node-cron');
  const { aggregateDailyStats } = require('./services/analyticsService');
  cron.schedule('0 0 * * *', () => {
    aggregateDailyStats().catch((e) => console.error('Analytics cron failed', e));
  });
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