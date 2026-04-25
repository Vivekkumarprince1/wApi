import mongoose, { Document, Schema, Model, Types } from 'mongoose';
import crypto from 'crypto';

export interface IIntegration {
  workspace: Types.ObjectId;
  type: 'webhook' | 'google_sheets' | 'zapier' | 'payment' | 'crm' | 'instagram' | 'email' | 'sms' | 'openai' | 'petpooja' | 'custom';
  name: string;
  description?: string;
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  
  config: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  configMetadata?: any;
  
  lastSyncAt?: Date;
  syncDirection: 'push' | 'pull' | 'bidirectional';
  syncInterval: number;
  nextSyncAt?: Date;
  
  lastError?: {
    message?: string;
    code?: string;
    timestamp?: Date;
    retryCount: number;
  };
  
  planLimits: {
    canUseWebhooks: boolean;
    canUseGoogleSheets: boolean;
    canUseZapier: boolean;
    canUseCRM: boolean;
    canUseOpenAI: boolean;
    rateLimitPerDay: number;
    rateLimitPerHour: number;
  };
  
  usage: {
    syncsThisMonth: number;
    syncErrors: number;
    lastSyncRecordsCount: number;
    totalRecordsSynced: number;
  };
  
  webhookConfig?: {
    url?: string;
    events: string[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    headers?: any;
    retryPolicy: { maxRetries: number; retryDelay: number };
    isActive: boolean;
  };
  
  credentials: {
    isExpiring: boolean;
    expiresAt?: Date;
    needsReauth: boolean;
    reauthUrl?: string;
  };
  
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  updatedBy?: Types.ObjectId;
  
  encryptionKeyVersion: number;
}

export interface IIntegrationDocument extends IIntegration, Document {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getDecryptedConfig(): any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setEncryptedConfig(configObj: any): void;
  validateConfig(): { valid: boolean; errors: string[] };
  markError(errorMessage: string, errorCode?: string): Promise<IIntegrationDocument>;
  markSynced(recordsCount?: number): Promise<IIntegrationDocument>;
  canSync(): boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toSafeJSON(): any;
}

export interface IIntegrationModel extends Model<IIntegrationDocument> {}

const ENCRYPTION_ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.INTEGRATION_ENCRYPTION_KEY || 'default-dev-key-change-in-production-32-chars!!';
const IV_LENGTH = 16;

const IntegrationSchema = new Schema<IIntegrationDocument, IIntegrationModel>({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  type: { type: String, enum: ['webhook', 'google_sheets', 'zapier', 'payment', 'crm', 'instagram', 'email', 'sms', 'openai', 'petpooja', 'custom'], required: true, index: true },
  name: { type: String, required: true, maxlength: 100 },
  description: { type: String, maxlength: 500 },
  status: { type: String, enum: ['connected', 'disconnected', 'error', 'pending'], default: 'pending', index: true },
  
  config: { type: String, required: true, select: false },
  configMetadata: { type: Schema.Types.Mixed, default: {} },
  
  lastSyncAt: Date,
  syncDirection: { type: String, enum: ['push', 'pull', 'bidirectional'], default: 'push' },
  syncInterval: { type: Number, default: 0, min: 0 },
  nextSyncAt: Date,
  
  lastError: {
    message: String,
    code: String,
    timestamp: Date,
    retryCount: { type: Number, default: 0 }
  },
  
  planLimits: {
    canUseWebhooks: { type: Boolean, default: true },
    canUseGoogleSheets: { type: Boolean, default: false },
    canUseZapier: { type: Boolean, default: false },
    canUseCRM: { type: Boolean, default: false },
    canUseOpenAI: { type: Boolean, default: false },
    rateLimitPerDay: { type: Number, default: 1000 },
    rateLimitPerHour: { type: Number, default: 100 }
  },
  
  usage: {
    syncsThisMonth: { type: Number, default: 0 },
    syncErrors: { type: Number, default: 0 },
    lastSyncRecordsCount: { type: Number, default: 0 },
    totalRecordsSynced: { type: Number, default: 0 }
  },
  
  webhookConfig: {
    url: String,
    events: [{ type: String, enum: ['message.sent', 'message.received', 'contact.created', 'contact.updated', 'conversation.started', 'order.created', 'order.updated', 'payment.completed', 'contact.bounced', 'custom'] }],
    headers: Schema.Types.Mixed,
    retryPolicy: { maxRetries: { type: Number, default: 3 }, retryDelay: { type: Number, default: 5000 } },
    isActive: { type: Boolean, default: true }
  },
  
  credentials: {
    isExpiring: { type: Boolean, default: false },
    expiresAt: Date,
    needsReauth: { type: Boolean, default: false },
    reauthUrl: String
  },
  
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  encryptionKeyVersion: { type: Number, default: 1 }
});

// @ts-ignore
function encryptConfig(configObj: any) {
  try {
    const key = ENCRYPTION_KEY.length === 32 ? ENCRYPTION_KEY : crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key as Buffer, iv);
    let encrypted = cipher.update(JSON.stringify(configObj), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  } catch (err: any) {
    throw new Error('Failed to encrypt configuration');
  }
}

function decryptConfig(encryptedString: string) {
  try {
    if (!encryptedString || !encryptedString.includes(':')) return null;
    const key = ENCRYPTION_KEY.length === 32 ? ENCRYPTION_KEY : crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const parts = encryptedString.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key as Buffer, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  } catch (err: any) {
    throw new Error('Failed to decrypt configuration');
  }
}

IntegrationSchema.methods.getDecryptedConfig = function() {
  return decryptConfig(this.config);
};

IntegrationSchema.methods.setEncryptedConfig = function(configObj: Record<string, unknown>) {
  this.config = encryptConfig(configObj);
};

// @ts-ignore
IntegrationSchema.methods.validateConfig = function() {
  const errors: string[] = [];
  const config = this.getDecryptedConfig();
  if (!config) return { valid: false, errors: ['Config is required'] };

  switch (this.type) {
    case 'webhook':
      if (!config.url || !config.url.startsWith('http')) errors.push('Valid webhook URL required');
      if (!Array.isArray(config.events) || config.events.length === 0) errors.push('At least one event type required');
      break;
    case 'google_sheets':
      if (!config.spreadsheetId) errors.push('Spreadsheet ID required');
      if (!config.accessToken) errors.push('Access token required');
      break;
    case 'petpooja':
      if (!config.vendorId) errors.push('Petpooja Vendor ID required');
      if (!config.apiKey) errors.push('Petpooja API Key required');
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
  }
  return { valid: errors.length === 0, errors };
};

IntegrationSchema.methods.markError = function(errorMessage: string, errorCode = 'UNKNOWN') {
  this.lastError = { message: errorMessage, code: errorCode, timestamp: new Date(), retryCount: (this.lastError?.retryCount || 0) + 1 };
  this.status = 'error';
  return this.save();
};

IntegrationSchema.methods.markSynced = function(recordsCount = 0) {
  this.lastSyncAt = new Date();
  if (this.syncInterval > 0) {
    this.nextSyncAt = new Date(Date.now() + this.syncInterval * 60000);
  }
  this.status = 'connected';
  this.lastError = undefined;
  if (recordsCount > 0) {
    this.usage.syncsThisMonth = (this.usage.syncsThisMonth || 0) + 1;
    this.usage.lastSyncRecordsCount = recordsCount;
    this.usage.totalRecordsSynced = (this.usage.totalRecordsSynced || 0) + recordsCount;
  }
  return this.save();
};

IntegrationSchema.methods.canSync = function() {
  if (!this.lastSyncAt) return true;
  return (Date.now() - this.lastSyncAt.getTime()) >= (this.syncInterval * 60000);
};

IntegrationSchema.methods.toSafeJSON = function() {
  return {
    _id: this._id, workspace: this.workspace, type: this.type, name: this.name,
    description: this.description, status: this.status, configMetadata: this.configMetadata,
    lastSyncAt: this.lastSyncAt, syncDirection: this.syncDirection, syncInterval: this.syncInterval,
    nextSyncAt: this.nextSyncAt, lastError: this.lastError, usage: this.usage, credentials: this.credentials,
    createdAt: this.createdAt, updatedAt: this.updatedAt, createdBy: this.createdBy
  };
};

IntegrationSchema.index({ workspace: 1, type: 1 });
IntegrationSchema.index({ workspace: 1, status: 1 });
IntegrationSchema.index({ workspace: 1, createdAt: -1 });
IntegrationSchema.index({ lastSyncAt: 1 });
IntegrationSchema.index({ nextSyncAt: 1 });

IntegrationSchema.pre<IIntegrationDocument>('save', function() {
  this.updatedAt = new Date();
  
});

IntegrationSchema.set('toJSON', {
  transform: (doc: any, ret: any) => {
    delete ret.config;
    return ret;
  }
});

export const Integration = (mongoose.models.Integration as IIntegrationModel) || mongoose.model<IIntegrationDocument, IIntegrationModel>('Integration', IntegrationSchema);
