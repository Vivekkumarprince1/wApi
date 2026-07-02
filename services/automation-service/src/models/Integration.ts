import mongoose, { Schema, Document, Model } from 'mongoose';
import crypto from 'crypto';
import { config as appConfig } from '../config';

const ENCRYPTION_ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = appConfig.integrationEncryptionKey;
const IV_LENGTH = 16;

export interface IIntegration extends Document {
  workspace: mongoose.Types.ObjectId;
  type: string;
  name: string;
  description?: string;
  status: string;
  config: string;
  configMetadata: any;
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
  usage: {
    syncsThisMonth: number;
    syncErrors: number;
    lastSyncRecordsCount: number;
    totalRecordsSynced: number;
  };
  credentials?: {
    isExpiring: boolean;
    expiresAt?: Date;
    needsReauth: boolean;
    reauthUrl?: string;
  };
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  getDecryptedConfig(): any;
  setEncryptedConfig(configObj: any): void;
  markError(errorMessage: string, errorCode?: string): Promise<IIntegration>;
  markSynced(recordsCount?: number): Promise<IIntegration>;
  canSync(): boolean;
  toSafeJSON(): any;
}

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

const IntegrationSchema = new Schema({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  type: { type: String, enum: ['webhook', 'google_sheets', 'zapier', 'payment', 'crm', 'instagram', 'meta_ads', 'email', 'sms', 'openai', 'petpooja', 'custom'], required: true, index: true },
  name: { type: String, required: true },
  description: { type: String },
  status: { type: String, enum: ['connected', 'disconnected', 'error', 'pending'], default: 'pending' },
  config: { type: String, select: false },
  configMetadata: { type: Schema.Types.Mixed, default: {} },
  lastSyncAt: Date,
  syncDirection: { type: String, enum: ['push', 'pull', 'bidirectional'], default: 'pull' },
  syncInterval: { type: Number, default: 0, min: 0 },
  nextSyncAt: Date,
  lastError: {
    message: String,
    code: String,
    timestamp: Date,
    retryCount: { type: Number, default: 0 }
  },
  usage: {
    syncsThisMonth: { type: Number, default: 0 },
    syncErrors: { type: Number, default: 0 },
    lastSyncRecordsCount: { type: Number, default: 0 },
    totalRecordsSynced: { type: Number, default: 0 }
  },
  credentials: {
    isExpiring: { type: Boolean, default: false },
    expiresAt: Date,
    needsReauth: { type: Boolean, default: false },
    reauthUrl: String
  },
  createdBy: { type: Schema.Types.ObjectId },
  updatedBy: { type: Schema.Types.ObjectId }
}, { timestamps: true });

IntegrationSchema.methods.getDecryptedConfig = function() {
  return decryptConfig(this.config);
};

IntegrationSchema.methods.setEncryptedConfig = function(configObj: any) {
  this.config = encryptConfig(configObj);
};

IntegrationSchema.methods.markError = function(errorMessage: string, errorCode = 'UNKNOWN') {
  this.lastError = {
    message: errorMessage,
    code: errorCode,
    timestamp: new Date(),
    retryCount: (this.lastError?.retryCount || 0) + 1
  };
  this.status = 'error';
  this.usage = {
    ...(this.usage || {}),
    syncErrors: ((this.usage?.syncErrors || 0) + 1)
  };
  return this.save();
};

IntegrationSchema.methods.markSynced = function(recordsCount = 0) {
  this.lastSyncAt = new Date();
  if (this.syncInterval > 0) {
    this.nextSyncAt = new Date(Date.now() + this.syncInterval * 60_000);
  }
  this.status = 'connected';
  this.lastError = undefined;
  this.usage = {
    syncsThisMonth: (this.usage?.syncsThisMonth || 0) + 1,
    syncErrors: this.usage?.syncErrors || 0,
    lastSyncRecordsCount: recordsCount,
    totalRecordsSynced: (this.usage?.totalRecordsSynced || 0) + recordsCount
  };
  return this.save();
};

IntegrationSchema.methods.canSync = function() {
  if (!this.lastSyncAt || !this.syncInterval) return true;
  return Date.now() - this.lastSyncAt.getTime() >= this.syncInterval * 60_000;
};

IntegrationSchema.methods.toSafeJSON = function() {
  const obj = this.toObject();
  delete obj.config;
  return obj;
};

IntegrationSchema.index({ workspace: 1, type: 1 }, { unique: true });
IntegrationSchema.index({ workspace: 1, status: 1 });
IntegrationSchema.index({ nextSyncAt: 1 });

export const Integration: Model<IIntegration> = (mongoose.models.Integration as any) || mongoose.model<IIntegration>('Integration', IntegrationSchema);
