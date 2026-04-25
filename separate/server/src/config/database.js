/**
 * DATABASE CONFIGURATION
 * MongoDB connection and configuration
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger');

const {
  MONGO_URI,
  DB_NAME,
  DB_USER,
  DB_PASS,
  DB_HOST,
  DB_PORT,
  NODE_ENV
} = process.env;

// Build MongoDB connection URI
function buildMongoUri() {
  // If explicit MONGO_URI is provided, use it
  if (MONGO_URI) {
    return MONGO_URI;
  }

  // Build URI from components
  const user = DB_USER ? `${encodeURIComponent(DB_USER)}:${encodeURIComponent(DB_PASS)}@` : '';
  const host = DB_HOST || 'localhost';
  const port = DB_PORT || '27017';
  const database = DB_NAME || 'wapi_development';

  return `mongodb://${user}${host}:${port}/${database}`;
}

// MongoDB connection options
const mongoOptions = {
  maxPoolSize: 10, // Maintain up to 10 socket connections
  serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
  socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
  bufferCommands: false, // Disable mongoose buffering
  bufferMaxEntries: 0, // Disable mongoose buffering
  useNewUrlParser: true,
  useUnifiedTopology: true,
};

// Additional options for production
if (NODE_ENV === 'production') {
  mongoOptions.ssl = true;
  mongoOptions.replicaSet = process.env.DB_REPLICA_SET;
  mongoOptions.authSource = 'admin';
}

/**
 * Connect to MongoDB
 */
async function connectDatabase() {
  try {
    const uri = buildMongoUri();

    logger.info('Connecting to MongoDB...', { uri: uri.replace(/\/\/.*@/, '//***:***@') });

    await mongoose.connect(uri, mongoOptions);

    logger.info('MongoDB connected successfully');

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error', { error: err.message });
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });

    return mongoose.connection;
  } catch (error) {
    logger.error('Failed to connect to MongoDB', { error: error.message });
    throw error;
  }
}

/**
 * Disconnect from MongoDB
 */
async function disconnectDatabase() {
  try {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected successfully');
  } catch (error) {
    logger.error('Failed to disconnect from MongoDB', { error: error.message });
    throw error;
  }
}

/**
 * Health check for database connection
 */
async function healthCheck() {
  try {
    const state = mongoose.connection.readyState;
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };

    return {
      status: states[state] || 'unknown',
      isHealthy: state === 1,
      database: mongoose.connection.name,
      host: mongoose.connection.host
    };
  } catch (error) {
    return {
      status: 'error',
      isHealthy: false,
      error: error.message
    };
  }
}

/**
 * Initialize database indexes
 */
async function initializeIndexes() {
  try {
    logger.info('Initializing database indexes...');

    // Import all models to ensure indexes are created
    require('../models');

    // Force index creation
    await mongoose.connection.db.admin().command({ ping: 1 });

    logger.info('Database indexes initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize database indexes', { error: error.message });
    throw error;
  }
}

module.exports = {
  connectDatabase,
  disconnectDatabase,
  healthCheck,
  initializeIndexes,
  mongoOptions,
  buildMongoUri
};