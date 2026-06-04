import mongoose, { Document, Schema, Types, Model } from 'mongoose';

export interface IWhatsAppFlow extends Document {
  workspace: Types.ObjectId;
  createdBy?: Types.ObjectId;
  name: string;
  categories: string[];
  status: 'DRAFT' | 'PUBLISHED' | 'DEPRECATED';
  gupshupFlowId?: string;
  previewUrl?: string;
}

const WhatsAppFlowSchema = new Schema({
  workspace: {
    type: Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  name: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    validate: {
      validator: function(v: string) {
        return /^[a-z0-9_]+$/.test(v);
      },
      message: 'Flow name can only contain lowercase letters, numbers, and underscores.'
    }
  },
  categories: [{
    type: String,
    required: true
  }],
  status: {
    type: String,
    enum: ['DRAFT', 'PUBLISHED', 'DEPRECATED'],
    default: 'DRAFT',
    index: true
  },
  gupshupFlowId: {
    type: String,
    sparse: true,
    index: true
  },
  previewUrl: {
    type: String
  }
}, {
  timestamps: true
});

WhatsAppFlowSchema.index({ workspace: 1, name: 1 }, { unique: true });

export const WhatsAppFlow: Model<IWhatsAppFlow> = (mongoose.models.WhatsAppFlow as any) || mongoose.model<IWhatsAppFlow>('WhatsAppFlow', WhatsAppFlowSchema);
