import mongoose, { Schema, Document, Model } from 'mongoose';
import crypto from 'crypto';
import { config as appConfig } from '../config';

const ENCRYPTION_ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = appConfig.integrationEncryptionKey || appConfig.jwtSecret || 'change-me-in-production';
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
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  getDecryptedConfig(): any;
  setEncryptedConfig(configObj: any): void;
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
  type: { type: String, enum: ['webhook', 'google_sheets', 'zapier', 'payment', 'crm', 'instagram', 'email', 'sms', 'openai', 'petpooja', 'custom'], required: true, index: true },
  name: { type: String, required: true },
  description: { type: String },
  status: { type: String, enum: ['connected', 'disconnected', 'error', 'pending'], default: 'pending' },
  config: { type: String, select: false },
  configMetadata: { type: Schema.Types.Mixed, default: {} },
  lastSyncAt: Date,
  createdBy: { type: Schema.Types.ObjectId },
  updatedBy: { type: Schema.Types.ObjectId }
}, { timestamps: true });

IntegrationSchema.methods.getDecryptedConfig = function() {
  return decryptConfig(this.config);
};

IntegrationSchema.methods.setEncryptedConfig = function(configObj: any) {
  this.config = encryptConfig(configObj);
};

IntegrationSchema.methods.toSafeJSON = function() {
  const obj = this.toObject();
  delete obj.config;
  return obj;
};

export const Integration: Model<IIntegration> = (mongoose.models.Integration as any) || mongoose.model<IIntegration>('Integration', IntegrationSchema);
