import mongoose, { Document, Model, Types } from 'mongoose';

export interface IWhatsAppFlow {
  workspace: Types.ObjectId;
  createdBy: Types.ObjectId;
  
  name: string;
  categories: string[];
  status: 'DRAFT' | 'PUBLISHED' | 'DEPRECATED';
  
  gupshupFlowId?: string;
  previewUrl?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface IWhatsAppFlowDocument extends IWhatsAppFlow, Document {
  _id: Types.ObjectId;
}

export interface IWhatsAppFlowModel extends Model<IWhatsAppFlowDocument> {
  // Add static methods here if needed
}

const WhatsAppFlowSchema = new mongoose.Schema({
  workspace: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    validate: {
      validator: function(v: string) {
        // Gupshup requires flow names to be lowercase, alphanumeric, and underscores only
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

// Compound index to ensure uniqueness of flow name within a workspace
WhatsAppFlowSchema.index({ workspace: 1, name: 1 }, { unique: true });

export const WhatsAppFlow = (mongoose.models.WhatsAppFlow as IWhatsAppFlowModel) || 
  mongoose.model<IWhatsAppFlowDocument, IWhatsAppFlowModel>('WhatsAppFlow', WhatsAppFlowSchema);
