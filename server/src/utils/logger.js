/**
 * STRUCTURED LOGGER
 * Centralized logging utility with structured output and levels
 */

const winston = require('winston');
const path = require('path');

// Define log levels
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

const LOG_COLORS = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue'
};

// Create winston logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels: LOG_LEVELS,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'whatsapp-saas' },
  transports: [
    // Write all logs with importance level of `error` or less to `error.log`
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'error.log'),
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      )
    }),
    // Write all logs with importance level of `info` or less to `combined.log`
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'combined.log'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ]
});

// If we're not in production then log to the console with colors
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize({ all: true }),
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
        let metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
        return `${timestamp} [${service}] ${level}: ${message}${metaStr}`;
      })
    )
  }));
}

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const normalizeMeta = (meta) => {
  if (meta === undefined || meta === null) return {};
  if (typeof meta === 'object' && !Array.isArray(meta)) return meta;
  return { value: meta };
};

// Logger methods with structured logging
const structuredLogger = {
  error: (message, meta = {}) => {
    logger.error(message, { ...normalizeMeta(meta), level: 'error' });
  },

  warn: (message, meta = {}) => {
    logger.warn(message, { ...normalizeMeta(meta), level: 'warn' });
  },

  info: (message, meta = {}) => {
    logger.info(message, { ...normalizeMeta(meta), level: 'info' });
  },

  http: (message, meta = {}) => {
    logger.http(message, { ...normalizeMeta(meta), level: 'http' });
  },

  debug: (message, meta = {}) => {
    logger.debug(message, { ...normalizeMeta(meta), level: 'debug' });
  },

  // Specialized logging methods
  apiRequest: (method, url, statusCode, duration, userId = null, workspaceId = null) => {
    logger.http('API Request', {
      method,
      url,
      statusCode,
      duration,
      userId,
      workspaceId,
      timestamp: new Date().toISOString()
    });
  },

  apiError: (method, url, statusCode, error, userId = null, workspaceId = null) => {
    logger.error('API Error', {
      method,
      url,
      statusCode,
      error: error.message,
      stack: error.stack,
      userId,
      workspaceId,
      timestamp: new Date().toISOString()
    });
  },

  bspOperation: (operation, bsp, success, duration, error = null) => {
    const level = success ? 'info' : 'error';
    const meta = {
      operation,
      bsp,
      duration,
      success,
      timestamp: new Date().toISOString()
    };

    if (error) {
      meta.error = error.message;
    }

    logger.log(level, `BSP ${operation}`, meta);
  },

  campaignEvent: (campaignId, event, data = {}) => {
    logger.info('Campaign Event', {
      campaignId,
      event,
      ...data,
      timestamp: new Date().toISOString()
    });
  },

  automationExecution: (ruleId, executionId, success, data = {}) => {
    const level = success ? 'info' : 'error';
    logger.log(level, 'Automation Execution', {
      ruleId,
      executionId,
      success,
      ...data,
      timestamp: new Date().toISOString()
    });
  },

  securityEvent: (event, severity, data = {}) => {
    const level = severity === 'high' ? 'error' : severity === 'medium' ? 'warn' : 'info';
    logger.log(level, 'Security Event', {
      event,
      severity,
      ...data,
      timestamp: new Date().toISOString()
    });
  }
};

module.exports = structuredLogger;
