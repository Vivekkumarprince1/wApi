import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface IInstagramQuickflow {
  workspace: Types.ObjectId;
  name: string;
  type: 'price_please' | 'giveaway' | 'lead_gen' | 'story_auto_reply' | 'custom';
  triggerType: 'comment' | 'dm' | 'story_reply' | 'mention';
  keywords: string[];
  matchMode: 'contains' | 'exact' | 'starts_with';
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IInstagramQuickflowDocument extends IInstagramQuickflow, Document {}

const InstagramQuickflowSchema = new Schema<IInstagramQuickflowDocument>({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['price_please', 'giveaway', 'lead_gen', 'story_auto_reply', 'custom'], required: true },
  triggerType: { type: String, enum: ['comment', 'dm', 'story_reply', 'mention'], required: true },
  keywords: [{ type: String, lowercase: true }],
  matchMode: { type: String, default: 'contains' },
  enabled: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const InstagramQuickflow = (mongoose.models.InstagramQuickflow as Model<IInstagramQuickflowDocument>) || mongoose.model<IInstagramQuickflowDocument>('InstagramQuickflow', InstagramQuickflowSchema);
