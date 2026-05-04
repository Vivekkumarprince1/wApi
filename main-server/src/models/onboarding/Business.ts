import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export type BusinessVerificationProvider = 'mock' | 'cleartax' | 'karza';
export type BusinessVerificationStatus = 'not_submitted' | 'pending' | 'verified' | 'rejected';

export interface IBusiness {
  workspace: Types.ObjectId;
  owner: Types.ObjectId;
  name: string;
  email?: string;
  category?: string;
  address: {
    line1?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  gstNumber?: string;
  msmeNumber?: string;
  panNumber?: string;
  legalName?: string;
  registryStatus?: string;
  verificationProvider?: BusinessVerificationProvider;
  verificationStatus: BusinessVerificationStatus;
  verificationPayload?: Record<string, unknown>;
  nameMatchScore?: number;
  confirmed: boolean;
  confirmedAt?: Date;
  verifiedAt?: Date;
  razorpayKeyId?: string;
  commerceSettings?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBusinessDocument extends IBusiness, Document {}

const BusinessSchema = new Schema<IBusinessDocument>({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, unique: true, index: true },
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, trim: true, lowercase: true },
  category: { type: String, trim: true },
  address: {
    line1: { type: String },
    city: { type: String },
    state: { type: String },
    country: { type: String, default: 'India' },
    postalCode: { type: String }
  },
  gstNumber: { type: String, uppercase: true, trim: true, sparse: true, index: true },
  msmeNumber: { type: String, uppercase: true, trim: true, sparse: true, index: true },
  panNumber: { type: String, uppercase: true, trim: true },
  legalName: { type: String },
  registryStatus: { type: String },
  verificationProvider: { type: String, enum: ['mock', 'cleartax', 'karza'], default: 'mock' },
  verificationStatus: {
    type: String,
    enum: ['not_submitted', 'pending', 'verified', 'rejected'],
    default: 'not_submitted',
    index: true
  },
  verificationPayload: { type: Schema.Types.Mixed },
  nameMatchScore: { type: Number },
  confirmed: { type: Boolean, default: false },
  confirmedAt: { type: Date },
  verifiedAt: { type: Date },
  razorpayKeyId: { type: String },
  commerceSettings: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

export const Business: Model<IBusinessDocument> =
  mongoose.models.Business || mongoose.model<IBusinessDocument>('Business', BusinessSchema);
