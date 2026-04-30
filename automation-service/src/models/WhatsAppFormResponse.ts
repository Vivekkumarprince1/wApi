import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IWhatsAppFormResponse extends Document {
  workspace: mongoose.Types.ObjectId;
  form: mongoose.Types.ObjectId;
  automationRule?: mongoose.Types.ObjectId;
  contact?: mongoose.Types.ObjectId;
  userPhone: string;
  userName?: string;
  userEmail?: string;
  responses: Map<string, any>;
  status: 'in_progress' | 'completed' | 'abandoned' | 'failed';
  currentStep: number;
  totalSteps?: number;
  completedSteps: number;
  startedAt: Date;
  completedAt?: Date;
  lastActivityAt?: Date;
  timeSpent?: number;
  flowToken?: string;
  actionName?: string;
  rawFlowPayload?: any;
  retryCount: number;
  abandonReason?: string;
  convertedToLead: boolean;
  leadId?: mongoose.Types.ObjectId;
  messageIds: string[];
  conversationId?: string;
  sourceType?: string;
  sourceId?: string;
  tags: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WhatsAppFormResponseSchema: Schema = new Schema({
  workspace: { type: Schema.Types.ObjectId, required: true, index: true },
  form: { type: Schema.Types.ObjectId, ref: 'WhatsAppForm', required: true, index: true },
  automationRule: { type: Schema.Types.ObjectId, index: true },
  contact: { type: Schema.Types.ObjectId },
  userPhone: { type: String, required: true, index: true },
  userName: String,
  userEmail: String,
  responses: { type: Map, of: Schema.Types.Mixed },
  status: { type: String, enum: ['in_progress', 'completed', 'abandoned', 'failed'], default: 'in_progress', index: true },
  currentStep: { type: Number, default: 0 },
  totalSteps: Number,
  completedSteps: { type: Number, default: 0 },
  startedAt: { type: Date, default: Date.now, index: true },
  completedAt: Date,
  lastActivityAt: Date,
  timeSpent: Number,
  flowToken: { type: String, index: true },
  actionName: String,
  rawFlowPayload: Schema.Types.Mixed,
  retryCount: { type: Number, default: 0 },
  abandonReason: String,
  convertedToLead: { type: Boolean, default: false },
  leadId: { type: Schema.Types.ObjectId },
  messageIds: [String],
  conversationId: String,
  sourceType: String,
  sourceId: String,
  tags: [String],
  notes: String
}, { timestamps: true });

WhatsAppFormResponseSchema.index({ workspace: 1, form: 1, status: 1 });
WhatsAppFormResponseSchema.index({ workspace: 1, userPhone: 1, form: 1 });

export const WhatsAppFormResponse: Model<IWhatsAppFormResponse> = mongoose.models.WhatsAppFormResponse || mongoose.model<IWhatsAppFormResponse>('WhatsAppFormResponse', WhatsAppFormResponseSchema);
