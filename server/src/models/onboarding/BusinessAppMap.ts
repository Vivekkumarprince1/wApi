import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface IBusinessAppMap {
  business: Types.ObjectId;
  workspace: Types.ObjectId;
  app: Types.ObjectId;
  gupshupAppId: string;
  assignmentSource?: 'workspace_existing' | 'sandbox_reclaimed' | 'fresh_created' | 'mock_created';
  active: boolean;
  assignedAt: Date;
  disconnectedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBusinessAppMapDocument extends IBusinessAppMap, Document {}

const BusinessAppMapSchema = new Schema<IBusinessAppMapDocument>({
  business: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  app: { type: Schema.Types.ObjectId, ref: 'GupshupApp', required: true, index: true },
  gupshupAppId: { type: String, required: true, index: true },
  assignmentSource: { type: String, enum: ['workspace_existing', 'sandbox_reclaimed', 'fresh_created', 'mock_created'] },
  active: { type: Boolean, default: true, index: true },
  assignedAt: { type: Date, default: Date.now },
  disconnectedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

BusinessAppMapSchema.index(
  { business: 1, active: 1 },
  { unique: true, partialFilterExpression: { active: true } }
);
BusinessAppMapSchema.index(
  { app: 1, active: 1 },
  { unique: true, partialFilterExpression: { active: true } }
);
BusinessAppMapSchema.index(
  { gupshupAppId: 1, active: 1 },
  { unique: true, partialFilterExpression: { active: true } }
);

export const BusinessAppMap: Model<IBusinessAppMapDocument> =
  mongoose.models.BusinessAppMap || mongoose.model<IBusinessAppMapDocument>('BusinessAppMap', BusinessAppMapSchema);
