import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface IInstagramQuickflowLog {
  workspace: Types.ObjectId;
  quickflow: Types.ObjectId;
  instagramUserId: string;
  instagramUsername?: string;
  triggerType?: 'comment' | 'dm' | 'story_reply' | 'mention';
  triggerPostId?: string;
  triggerMessageId?: string;
  triggerContent?: string;
  
  responseSent: boolean;
  responseContent?: string;
  responseId?: string;
  
  whatsappRedirected: boolean;
  whatsappPhoneNumber?: string;
  
  triggeredAt: Date;
  replySentAt?: Date;
  expiresAt: Date;
}

export interface IInstagramQuickflowLogDocument extends IInstagramQuickflowLog, Document {}

const InstagramQuickflowLogSchema = new Schema<IInstagramQuickflowLogDocument>({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  quickflow: { type: Schema.Types.ObjectId, ref: 'InstagramQuickflow', required: true, index: true },
  instagramUserId: { type: String, required: true },
  instagramUsername: String,
  triggerType: { type: String, enum: ['comment', 'dm', 'story_reply', 'mention'] },
  triggerPostId: String,
  triggerMessageId: String,
  triggerContent: String,
  
  responseSent: { type: Boolean, default: false },
  responseContent: String,
  responseId: String,
  
  whatsappRedirected: { type: Boolean, default: false },
  whatsappPhoneNumber: String,
  
  triggeredAt: { type: Date, default: Date.now, index: true },
  replySentAt: Date,
  expiresAt: { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }
});

InstagramQuickflowLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
InstagramQuickflowLogSchema.index({ workspace: 1, quickflow: 1, instagramUserId: 1, triggeredAt: -1 });

export const InstagramQuickflowLog = (mongoose.models.InstagramQuickflowLog as Model<IInstagramQuickflowLogDocument>) || mongoose.model<IInstagramQuickflowLogDocument>('InstagramQuickflowLog', InstagramQuickflowLogSchema);
