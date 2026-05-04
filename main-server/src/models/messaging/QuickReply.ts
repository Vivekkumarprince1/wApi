import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface IQuickReplyVariable {
  name?: string;
  fallback?: string;
}

export interface IQuickReply {
  workspace: Types.ObjectId;
  name: string;
  shortcut?: string;
  content: string;
  mediaUrl?: string;
  mediaType?: string;
  variables: IQuickReplyVariable[];
  isActive: boolean;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IQuickReplyDocument extends IQuickReply, Document {}

const QuickReplySchema = new Schema<IQuickReplyDocument>({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
  name: { type: String, required: true },
  shortcut: { type: String },
  content: { type: String, required: true },
  mediaUrl: { type: String },
  mediaType: { type: String },
  variables: [{
    name: { type: String },
    fallback: { type: String }
  }],
  isActive: { type: Boolean, default: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  owner: { type: Schema.Types.ObjectId, ref: 'User' }, // For personal replies
  scope: { type: String, enum: ['workspace', 'personal'], default: 'workspace' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

QuickReplySchema.index({ workspace: 1, scope: 1, owner: 1 });
QuickReplySchema.index({ workspace: 1, name: 1, scope: 1, owner: 1 }, { unique: true });
QuickReplySchema.index({ workspace: 1, shortcut: 1 });

QuickReplySchema.pre<IQuickReplyDocument>('save', function() {
  this.updatedAt = new Date();
  
});

export const QuickReply = (mongoose.models.QuickReply as Model<IQuickReplyDocument>) || mongoose.model<IQuickReplyDocument>('QuickReply', QuickReplySchema);
