import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface ITemplateMetric {
  workspaceId: Types.ObjectId;
  phoneNumberId: string;
  templateName: string;
  contentHash: string;
  status: 'created' | 'rejected' | 'approved' | 'disabled';
  rejectionReason?: string | null;
  retryCount: number;
  createdAt: Date;
  approvedAt?: Date | null;
}

export interface ITemplateMetricDocument extends ITemplateMetric, Document {}

const TemplateMetricSchema = new Schema<ITemplateMetricDocument>({
  workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  phoneNumberId: { type: String, required: true, index: true },
  templateName: { type: String, required: true, index: true },
  contentHash: { type: String, required: true },
  status: { type: String, enum: ['created', 'rejected', 'approved', 'disabled'], default: 'created', index: true },
  rejectionReason: { type: String, default: null },
  retryCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  approvedAt: { type: Date, default: null }
}, { timestamps: false });

TemplateMetricSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

export const TemplateMetric = (mongoose.models.TemplateMetric as Model<ITemplateMetricDocument>) || mongoose.model<ITemplateMetricDocument>('TemplateMetric', TemplateMetricSchema);
