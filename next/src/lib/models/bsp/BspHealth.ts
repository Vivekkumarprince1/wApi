import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IBspHealth {
  key: string;
  status: 'healthy' | 'warning' | 'critical';
  isValid: boolean;
  expiresAt?: Date;
  checkedAt?: Date;
  lastHealthyAt?: Date;
  error?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  meta?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBspHealthDocument extends IBspHealth, Document {}

const BspHealthSchema = new Schema<IBspHealthDocument>({
  key: { type: String, required: true, unique: true },
  status: { type: String, enum: ['healthy', 'warning', 'critical'], default: 'warning' },
  isValid: { type: Boolean, default: false },
  expiresAt: { type: Date },
  checkedAt: { type: Date },
  lastHealthyAt: { type: Date },
  error: { type: String },
  meta: { type: Schema.Types.Mixed }
}, { timestamps: true });

export const BspHealth = (mongoose.models.BspHealth as Model<IBspHealthDocument>) || mongoose.model<IBspHealthDocument>('BspHealth', BspHealthSchema);
