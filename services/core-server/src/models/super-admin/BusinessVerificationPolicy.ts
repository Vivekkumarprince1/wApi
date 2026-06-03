import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface IBusinessVerificationPolicy {
  key: string;
  mandatory: boolean;
  updatedBy?: Types.ObjectId;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBusinessVerificationPolicyDocument extends IBusinessVerificationPolicy, Document {}

const BusinessVerificationPolicySchema = new Schema<IBusinessVerificationPolicyDocument>({
  key: { type: String, required: true, unique: true, index: true, default: 'global', trim: true },
  mandatory: { type: Boolean, default: false, index: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  notes: { type: String, trim: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

export const BusinessVerificationPolicy: Model<IBusinessVerificationPolicyDocument> =
  mongoose.models.BusinessVerificationPolicy || mongoose.model<IBusinessVerificationPolicyDocument>('BusinessVerificationPolicy', BusinessVerificationPolicySchema);