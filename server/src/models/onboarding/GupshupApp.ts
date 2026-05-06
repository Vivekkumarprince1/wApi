import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export type GupshupAppStatus = 'sandbox' | 'inactive' | 'assigned' | 'live' | 'disconnected' | 'failed';

export interface IGupshupApp {
  gupshupAppId: string;
  appName?: string;
  encryptedApiKey?: string;
  appApiKeyExpiresAt?: Date;
  appApiKeyRefreshedAt?: Date;
  status: GupshupAppStatus;
  assigned: boolean;
  assignedToBusiness?: Types.ObjectId;
  assignedToWorkspace?: Types.ObjectId;
  phoneNumber?: string;
  phoneNumberId?: string;
  wabaId?: string;
  providerPayload?: Record<string, unknown>;
  lastSyncedAt?: Date;
  assignedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IGupshupAppDocument extends IGupshupApp, Document {}

const GupshupAppSchema = new Schema<IGupshupAppDocument>({
  gupshupAppId: { type: String, required: true, unique: true, index: true },
  appName: { type: String },
  encryptedApiKey: { type: String },
  appApiKeyExpiresAt: { type: Date },
  appApiKeyRefreshedAt: { type: Date },
  status: {
    type: String,
    enum: ['sandbox', 'inactive', 'assigned', 'live', 'disconnected', 'failed'],
    default: 'sandbox',
    index: true
  },
  assigned: { type: Boolean, default: false, index: true },
  assignedToBusiness: { type: Schema.Types.ObjectId, ref: 'Business', sparse: true, index: true },
  assignedToWorkspace: { type: Schema.Types.ObjectId, ref: 'Workspace', sparse: true, index: true },
  phoneNumber: { type: String },
  phoneNumberId: { type: String, sparse: true, index: true },
  wabaId: { type: String },
  providerPayload: { type: Schema.Types.Mixed },
  lastSyncedAt: { type: Date },
  assignedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

GupshupAppSchema.index({ assigned: 1, status: 1, updatedAt: 1 });

export const GupshupApp: Model<IGupshupAppDocument> =
  mongoose.models.GupshupApp || mongoose.model<IGupshupAppDocument>('GupshupApp', GupshupAppSchema);
