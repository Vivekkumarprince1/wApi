import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface IAutoReplyLog {
  workspace: Types.ObjectId;
  autoReply: Types.ObjectId;
  contact: Types.ObjectId;
  messageId?: Types.ObjectId;
  sentAt: Date;
}

export interface IAutoReplyLogDocument extends IAutoReplyLog, Document {}

const AutoReplyLogSchema = new Schema<IAutoReplyLogDocument>({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
  autoReply: { type: Schema.Types.ObjectId, ref: 'AutoReply', required: true },
  contact: { type: Schema.Types.ObjectId, ref: 'Contact', required: true },
  messageId: { type: Schema.Types.ObjectId, ref: 'Message' },
  sentAt: { type: Date, default: Date.now }
});

AutoReplyLogSchema.index({ workspace: 1, contact: 1, autoReply: 1, sentAt: -1 });
AutoReplyLogSchema.index({ autoReply: 1, contact: 1, sentAt: -1 });
AutoReplyLogSchema.index({ sentAt: 1 }, { expireAfterSeconds: 2592000 });

export const AutoReplyLog = (mongoose.models.AutoReplyLog as Model<IAutoReplyLogDocument>) || mongoose.model<IAutoReplyLogDocument>('AutoReplyLog', AutoReplyLogSchema);
