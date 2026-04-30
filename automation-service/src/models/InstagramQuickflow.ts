import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface IInstagramQuickflow {
  workspace: Types.ObjectId;
  name: string;
  type: 'price_please' | 'giveaway' | 'lead_gen' | 'story_auto_reply' | 'custom';
  triggerType: 'comment' | 'dm' | 'story_reply' | 'mention';
  keywords: string[];
  matchMode: 'contains' | 'exact' | 'starts_with';
  
  response: {
    message?: string;
    template?: Types.ObjectId;
    redirectToWhatsApp?: {
      enabled: boolean;
      message?: string;
    };
  };
  
  enabled: boolean;
  totalTriggered: number;
  totalRepliesSent: number;
  lastTriggeredAt?: Date;
  lastReplySentAt?: Date;
  
  rateLimitEnabled: boolean;
  rateLimitWindow: number;
  
  preset: boolean;
  presetName?: 'price_please' | 'giveaway' | 'lead_gen' | 'story_auto_reply';
  
  createdAt: Date;
  updatedAt: Date;
}

export interface IInstagramQuickflowDocument extends IInstagramQuickflow, Document {}

const InstagramQuickflowSchema = new Schema<IInstagramQuickflowDocument>({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['price_please', 'giveaway', 'lead_gen', 'story_auto_reply', 'custom'], required: true, index: true },
  triggerType: { type: String, enum: ['comment', 'dm', 'story_reply', 'mention'], required: true },
  keywords: [{ type: String, lowercase: true }],
  matchMode: { type: String, enum: ['contains', 'exact', 'starts_with'], default: 'contains' },
  
  response: {
    message: String,
    template: { type: Schema.Types.ObjectId, ref: 'Template' },
    redirectToWhatsApp: {
      enabled: { type: Boolean, default: false },
      message: String
    }
  },
  
  enabled: { type: Boolean, default: true, index: true },
  totalTriggered: { type: Number, default: 0 },
  totalRepliesSent: { type: Number, default: 0 },
  lastTriggeredAt: Date,
  lastReplySentAt: Date,
  
  rateLimitEnabled: { type: Boolean, default: true },
  rateLimitWindow: { type: Number, default: 24 },
  
  preset: { type: Boolean, default: false },
  presetName: { type: String, enum: ['price_please', 'giveaway', 'lead_gen', 'story_auto_reply'] },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

InstagramQuickflowSchema.index({ workspace: 1, enabled: 1 });
InstagramQuickflowSchema.index({ workspace: 1, type: 1 });
InstagramQuickflowSchema.index({ workspace: 1, triggerType: 1 });

export const InstagramQuickflow = (mongoose.models.InstagramQuickflow as Model<IInstagramQuickflowDocument>) || mongoose.model<IInstagramQuickflowDocument>('InstagramQuickflow', InstagramQuickflowSchema);
