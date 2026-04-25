import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * WHATSAPP FORMS - Stage 8 (Meta Flows)
 */

export interface IFormScreen {
  id: string;
  title?: string;
  layout: {
    type: string;
    children: any[];
  };
  data?: any;
  terminal: boolean;
}

export interface IDataMapping {
  flowFieldId: string;
  crmField: string;
  saveAsTrait: boolean;
}

export interface IWhatsAppForm extends Document {
  workspace: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  status: 'draft' | 'published';
  flowType: 'static' | 'dynamic';
  flowId?: string;
  flowVersion: string;
  screens: IFormScreen[];
  rawFlowJson?: any;
  dataMapping: IDataMapping[];
  webhookConfig?: {
    enabled: boolean;
    url?: string;
    method: string;
    headers?: any;
  };
  config: {
    fallbackMessage: string;
    sendConfirmationMessage: boolean;
    confirmationText?: string;
  };
  statistics: {
    totalResponses: number;
    completedResponses: number;
    abandonedResponses: number;
    totalStarts: number;
    completionRate: number;
    lastResponseAt?: Date;
    averageTimeSpent?: number;
  };
  createdBy: mongoose.Types.ObjectId;
  publishedAt?: Date;
  publishedBy?: mongoose.Types.ObjectId;
  tags: string[];
  category?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

const ScreenSchema = new Schema({
  id: String,
  title: String,
  layout: {
    type: { type: String, default: 'SingleColumnLayout' },
    children: [Schema.Types.Mixed]
  },
  data: Schema.Types.Mixed,
  terminal: { type: Boolean, default: false }
}, { _id: false });

const MappingSchema = new Schema({
  flowFieldId: String,
  crmField: String,
  saveAsTrait: { type: Boolean, default: true }
}, { _id: false });

const WhatsAppFormSchema: Schema = new Schema({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  name: { type: String, required: true },
  description: { type: String },
  status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
  flowType: { type: String, enum: ['static', 'dynamic'], default: 'static' },
  flowId: { type: String, index: true },
  flowVersion: { type: String, default: '1.0' },
  screens: [ScreenSchema],
  rawFlowJson: Schema.Types.Mixed,
  dataMapping: [MappingSchema],
  webhookConfig: {
    enabled: { type: Boolean, default: false },
    url: String,
    method: { type: String, default: 'POST' },
    headers: Schema.Types.Mixed
  },
  config: {
    fallbackMessage: { type: String, default: 'Please update your WhatsApp to use interactive forms.' },
    sendConfirmationMessage: { type: Boolean, default: true },
    confirmationText: String
  },
  statistics: {
    totalResponses: { type: Number, default: 0 },
    completedResponses: { type: Number, default: 0 },
    abandonedResponses: { type: Number, default: 0 },
    totalStarts: { type: Number, default: 0 },
    completionRate: { type: Number, default: 0 },
    lastResponseAt: Date,
    averageTimeSpent: Number
  },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  publishedAt: Date,
  publishedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  tags: [String],
  category: String,
  deletedAt: Date
}, { timestamps: true });

WhatsAppFormSchema.index({ workspace: 1, status: 1 });
WhatsAppFormSchema.index({ workspace: 1, createdAt: -1 });

export const WhatsAppForm: Model<IWhatsAppForm> = mongoose.models.WhatsAppForm || mongoose.model<IWhatsAppForm>('WhatsAppForm', WhatsAppFormSchema);
