import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface IInternalNote {
  workspace: Types.ObjectId;
  conversation: Types.ObjectId;
  contact: Types.ObjectId;
  
  content: string;
  createdBy: Types.ObjectId;
  mentions: Types.ObjectId[];
  referencedMessage?: Types.ObjectId;
  
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface IInternalNoteDocument extends IInternalNote, Document {}

export interface IInternalNoteModel extends Model<IInternalNoteDocument> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getForConversation(conversationId: string | Types.ObjectId, options?: any): Promise<IInternalNoteDocument[]>;
}

const InternalNoteSchema = new Schema<IInternalNoteDocument, IInternalNoteModel>({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
  contact: { type: Schema.Types.ObjectId, ref: 'Contact', required: true },
  
  content: { type: String, required: true, maxlength: 5000 },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  mentions: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  referencedMessage: { type: Schema.Types.ObjectId, ref: 'Message' },
  
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

InternalNoteSchema.index({ conversation: 1, createdAt: -1 });
InternalNoteSchema.index({ workspace: 1, contact: 1, createdAt: -1 });
InternalNoteSchema.index({ workspace: 1, createdBy: 1 });

InternalNoteSchema.pre<IInternalNoteDocument>('save', function() {
  this.updatedAt = new Date();
  
});

// @ts-ignore
InternalNoteSchema.statics.getForConversation = async function(conversationId, options: any = {}) {
  const { page = 1, limit = 50 } = options;
  return this.find({ conversation: conversationId, isDeleted: false })
    .populate('createdBy', 'name email')
    .populate('mentions', 'name email')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
};

export const InternalNote = (mongoose.models.InternalNote as IInternalNoteModel) || mongoose.model<IInternalNoteDocument, IInternalNoteModel>('InternalNote', InternalNoteSchema);
