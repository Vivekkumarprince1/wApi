import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface IInstagramQuickflowLog {
  workspace: Types.ObjectId;
  quickflow: Types.ObjectId;
  contact: Types.ObjectId;
  triggerType: string;
  sourceId: string;
  status: 'pending' | 'success' | 'failed';
  error?: string;
  createdAt: Date;
}

export interface IInstagramQuickflowLogDocument extends IInstagramQuickflowLog, Document {}

const InstagramQuickflowLogSchema = new Schema<IInstagramQuickflowLogDocument>({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  quickflow: { type: Schema.Types.ObjectId, ref: 'InstagramQuickflow', required: true },
  contact: { type: Schema.Types.ObjectId, ref: 'Contact', required: true },
  triggerType: { type: String, required: true },
  sourceId: { type: String, required: true },
  status: { type: String, default: 'success' },
  error: String,
  createdAt: { type: Date, default: Date.now }
});

export const InstagramQuickflowLog = (mongoose.models.InstagramQuickflowLog as Model<IInstagramQuickflowLogDocument>) || mongoose.model<IInstagramQuickflowLogDocument>('InstagramQuickflowLog', InstagramQuickflowLogSchema);
