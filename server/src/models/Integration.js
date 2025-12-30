const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * Integration Model - Multi-tenant integration management
 * 
 * Supports:
 * - webhook: Custom webhook endpoints
 * - google_sheets: Google Sheets sync
 * - zapier: Zapier integration
 * - payment: Payment gateway webhooks
 * - crm: CRM connectors (Salesforce, HubSpot, etc.)
 * - instagram: Instagram Business account
 * - email: Email service providers
 * 
 * Security:
 * - Secrets encrypted at rest (AES-256-CBC)
 * - Never logged or exposed in responses
 * - Only accessible by workspace admins
 */

const IntegrationSchema = new mongoose.Schema({
  // Tenant isolation
  workspace: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },

  // Integration type
  type: {
    type: String,
    enum: [
      'webhook',
      'google_sheets',
      'zapier',
      'payment',
      'crm',
      'instagram',
      'email',
      'sms',
      'openai',
      'custom'
    ],
    required: true,
    index: true
  },

  // Display name for user
  name: {
    type: String,
    required: true,
    maxlength: 100
  },

  // Description of what this integration does
  description: {
    type: String,
    maxlength: 500
  },

  // Connection status
  status: {
    type: String,
    enum: ['connected', 'disconnected', 'error', 'pending'],
    default: 'pending',
    index: true
  },

  // ✅ Encrypted configuration per type
  // For webhook: { url, secret, events }
  // For google_sheets: { spreadsheetId, sheetName, accessToken }
  // For zapier: { webhookUrl, zapierApiKey }
  // For payment: { provider, apiKey, webhookSecret }
  // For crm: { provider, apiKey, instanceUrl }
  // For instagram: { accountId, accessToken }
  // For email: { provider, apiKey, domain }
  // For sms: { provider, apiKey, fromNumber }
  // For openai: { apiKey, organization }
  config: {
    type: String, // Encrypted JSON
    required: true,
    select: false // Exclude by default for security
  },

  // Plain config metadata (no secrets)
  // Used for listing without exposing secrets
  configMetadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Last synchronization timestamp
  lastSyncAt: {
    type: Date
  },

  // Sync direction for bidirectional integrations
  // 'push', 'pull', 'bidirectional'
  syncDirection: {
    type: String,
    enum: ['push', 'pull', 'bidirectional'],
    default: 'push'
  },

  // Sync interval in minutes (0 = manual)
  syncInterval: {
    type: Number,
    default: 0,
    min: 0
  },

  // Next scheduled sync
  nextSyncAt: {
    type: Date
  },

  // Last error details
  lastError: {
    message: { type: String },
    code: { type: String },
    timestamp: { type: Date },
    retryCount: { type: Number, default: 0 }
  },

  // Plan limits and usage
  planLimits: {
    // Only specific features based on plan
    canUseWebhooks: { type: Boolean, default: true }, // free: false, basic+: true
    canUseGoogleSheets: { type: Boolean, default: false }, // free: false, premium+: true
    canUseZapier: { type: Boolean, default: false }, // enterprise only
    canUseCRM: { type: Boolean, default: false }, // premium+
    canUseOpenAI: { type: Boolean, default: false }, // premium+
    rateLimitPerDay: { type: Number, default: 1000 },
    rateLimitPerHour: { type: Number, default: 100 }
  },

  // Usage tracking
  usage: {
    syncsThisMonth: { type: Number, default: 0 },
    syncErrors: { type: Number, default: 0 },
    lastSyncRecordsCount: { type: Number, default: 0 },
    totalRecordsSynced: { type: Number, default: 0 }
  },

  // Webhook-specific fields
  webhookConfig: {
    url: { type: String }, // Stored here before encryption
    events: [
      {
        type: String,
        enum: [
          'message.sent',
          'message.received',
          'contact.created',
          'contact.updated',
          'conversation.started',
          'order.created',
          'order.updated',
          'payment.completed',
          'contact.bounced',
          'custom'
        ]
      }
    ],
    headers: { type: mongoose.Schema.Types.Mixed }, // Custom headers
    retryPolicy: {
      maxRetries: { type: Number, default: 3 },
      retryDelay: { type: Number, default: 5000 } // milliseconds
    },
    isActive: { type: Boolean, default: true }
  },

  // API keys and credentials status
  credentials: {
    isExpiring: { type: Boolean, default: false },
    expiresAt: { type: Date },
    needsReauth: { type: Boolean, default: false },
    reauthUrl: { type: String }
  },

  // Audit trail
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },

  updatedAt: {
    type: Date,
    default: Date.now
  },

  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Encryption key identifier (for key rotation)
  encryptionKeyVersion: {
    type: Number,
    default: 1
  }
});

// ============================================================================
// ENCRYPTION/DECRYPTION HELPERS
// ============================================================================

const ENCRYPTION_ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.INTEGRATION_ENCRYPTION_KEY || 'default-dev-key-change-in-production-32-chars!!';
const IV_LENGTH = 16; // For AES, this is always 16

/**
 * Encrypt sensitive config
 * @param {Object} configObj - Config object to encrypt
 * @returns {string} Encrypted string (iv:encryptedData)
 */
function encryptConfig(configObj) {
  try {
    const key = ENCRYPTION_KEY.length === 32 ? ENCRYPTION_KEY : crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

    let encrypted = cipher.update(JSON.stringify(configObj), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Return iv:encrypted format for storage
    return iv.toString('hex') + ':' + encrypted;
  } catch (err) {
    console.error('Encryption error:', err.message);
    throw new Error('Failed to encrypt configuration');
  }
}

/**
 * Decrypt sensitive config
 * @param {string} encryptedString - Encrypted string in format iv:encryptedData
 * @returns {Object} Decrypted config object
 */
function decryptConfig(encryptedString) {
  try {
    if (!encryptedString || !encryptedString.includes(':')) {
      return null;
    }

    const key = ENCRYPTION_KEY.length === 32 ? ENCRYPTION_KEY : crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const parts = encryptedString.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];

    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  } catch (err) {
    console.error('Decryption error:', err.message);
    throw new Error('Failed to decrypt configuration');
  }
}

// ============================================================================
// INSTANCE METHODS
// ============================================================================

/**
 * Get decrypted configuration (requires explicit call)
 * @returns {Object} Decrypted config
 */
IntegrationSchema.methods.getDecryptedConfig = function() {
  return decryptConfig(this.config);
};

/**
 * Set encrypted configuration
 * @param {Object} configObj - Config object to encrypt
 */
IntegrationSchema.methods.setEncryptedConfig = function(configObj) {
  this.config = encryptConfig(configObj);
};

/**
 * Validate configuration per type
 * @returns {Object} { valid: boolean, errors: string[] }
 */
IntegrationSchema.methods.validateConfig = function() {
  const errors = [];
  const config = this.getDecryptedConfig();

  if (!config) {
    return { valid: false, errors: ['Config is required'] };
  }

  switch (this.type) {
    case 'webhook':
      if (!config.url || !config.url.startsWith('http')) {
        errors.push('Valid webhook URL required');
      }
      if (!Array.isArray(config.events) || config.events.length === 0) {
        errors.push('At least one event type required');
      }
      break;

    case 'google_sheets':
      if (!config.spreadsheetId) errors.push('Spreadsheet ID required');
      if (!config.accessToken) errors.push('Access token required');
      break;

    case 'zapier':
      if (!config.webhookUrl) errors.push('Zapier webhook URL required');
      break;

    case 'payment':
      if (!config.provider) errors.push('Payment provider required');
      if (!config.apiKey) errors.push('API key required');
      if (!config.webhookSecret) errors.push('Webhook secret required');
      break;

    case 'crm':
      if (!config.provider) errors.push('CRM provider required');
      if (!config.apiKey) errors.push('API key required');
      break;

    case 'email':
      if (!config.provider) errors.push('Email provider required');
      if (!config.apiKey) errors.push('API key required');
      break;

    case 'sms':
      if (!config.provider) errors.push('SMS provider required');
      if (!config.apiKey) errors.push('API key required');
      if (!config.fromNumber) errors.push('From number required');
      break;

    case 'openai':
      if (!config.apiKey) errors.push('OpenAI API key required');
      break;

    default:
      break;
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Mark as error and track retry
 */
IntegrationSchema.methods.markError = function(errorMessage, errorCode = 'UNKNOWN') {
  this.lastError = {
    message: errorMessage,
    code: errorCode,
    timestamp: new Date(),
    retryCount: (this.lastError?.retryCount || 0) + 1
  };
  this.status = 'error';
  return this.save();
};

/**
 * Mark as synced successfully
 */
IntegrationSchema.methods.markSynced = function(recordsCount = 0) {
  this.lastSyncAt = new Date();
  if (this.syncInterval > 0) {
    const nextSync = new Date(Date.now() + this.syncInterval * 60000);
    this.nextSyncAt = nextSync;
  }
  this.status = 'connected';
  this.lastError = null;
  if (recordsCount > 0) {
    this.usage.syncsThisMonth = (this.usage.syncsThisMonth || 0) + 1;
    this.usage.lastSyncRecordsCount = recordsCount;
    this.usage.totalRecordsSynced = (this.usage.totalRecordsSynced || 0) + recordsCount;
  }
  return this.save();
};

/**
 * Check if integration can sync based on rate limits
 */
IntegrationSchema.methods.canSync = function() {
  if (!this.lastSyncAt) return true;

  const lastSync = this.lastSyncAt.getTime();
  const now = Date.now();
  const minInterval = this.syncInterval * 60000; // Convert to milliseconds

  return (now - lastSync) >= minInterval;
};

/**
 * Get safe metadata for API responses (no secrets)
 */
IntegrationSchema.methods.toSafeJSON = function() {
  return {
    _id: this._id,
    workspace: this.workspace,
    type: this.type,
    name: this.name,
    description: this.description,
    status: this.status,
    configMetadata: this.configMetadata,
    lastSyncAt: this.lastSyncAt,
    syncDirection: this.syncDirection,
    syncInterval: this.syncInterval,
    nextSyncAt: this.nextSyncAt,
    lastError: this.lastError,
    usage: this.usage,
    credentials: this.credentials,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    createdBy: this.createdBy
  };
};

// ============================================================================
// INDEXES
// ============================================================================

IntegrationSchema.index({ workspace: 1, type: 1 }, { unique: false });
IntegrationSchema.index({ workspace: 1, status: 1 });
IntegrationSchema.index({ workspace: 1, createdAt: -1 });
IntegrationSchema.index({ lastSyncAt: 1 }); // For sync jobs
IntegrationSchema.index({ nextSyncAt: 1 }); // For scheduled syncs

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Update timestamp on save
IntegrationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Ensure secrets are never logged
IntegrationSchema.set('toJSON', {
  transform: function(doc, ret) {
    delete ret.config; // Never return encrypted config in JSON
    return ret;
  }
});

module.exports = mongoose.model('Integration', IntegrationSchema);
