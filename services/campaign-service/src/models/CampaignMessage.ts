import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface ICampaignMessage {
  workspace: Types.ObjectId;
  campaign: Types.ObjectId;
  message?: Types.ObjectId;
  contact: Types.ObjectId;
  phone?: string;
  internalMessageId: string;
  provider: string;
  status: 'pending' | 'queued' | 'dispatching' | 'accepted' | 'sent' | 'delivered' | 'read' | 'failed' | 'rejected' | 'expired' | 'unknown' | 'reconciliation_required';
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: Date;
  lastError?: string;
  errorCode?: string;
  whatsappMessageId?: string;
  lastProviderEvent?: string;
  queuedAt?: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  repliedAt?: Date;
  failedAt?: Date;
  failureReason?: string;
  batchId?: Types.ObjectId;
  batchIndex?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICampaignMessageDocument extends ICampaignMessage, Document {}

export interface ICampaignMessageModel extends Model<ICampaignMessageDocument> {
  getStatusCounts(campaignId: string | Types.ObjectId): Promise<Record<string, number>>;
  findByWhatsAppId(whatsappMessageId: string): Promise<ICampaignMessageDocument | null>;
}

const CampaignMessageSchema = new Schema<ICampaignMessageDocument, ICampaignMessageModel>({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  campaign: { type: Schema.Types.ObjectId, ref: 'Campaign', required: true, index: true },
  message: { type: Schema.Types.ObjectId, ref: 'Message' },
  contact: { type: Schema.Types.ObjectId, ref: 'Contact', required: true, index: true },
  phone: { type: String },
  internalMessageId: { type: String, required: true, index: true },
  provider: { type: String, default: 'gupshup' },
  status: { type: String, enum: ['pending', 'queued', 'dispatching', 'accepted', 'sent', 'delivered', 'read', 'failed', 'rejected', 'expired', 'unknown', 'reconciliation_required'], default: 'queued', index: true },
  attempts: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 3 },
  lastAttemptAt: Date, lastError: String, errorCode: String,
  whatsappMessageId: { type: String },
  lastProviderEvent: String,
  queuedAt: Date, sentAt: Date, deliveredAt: Date, readAt: Date, repliedAt: Date, failedAt: Date,
  failureReason: String,
  batchId: { type: Schema.Types.ObjectId, ref: 'CampaignBatch' },
  batchIndex: Number,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

CampaignMessageSchema.index({ campaign: 1, contact: 1 }, { unique: true });
CampaignMessageSchema.index({ workspace: 1, internalMessageId: 1 }, { unique: true });
CampaignMessageSchema.index({ campaign: 1, status: 1 });
CampaignMessageSchema.index({ campaign: 1, createdAt: -1 });
CampaignMessageSchema.index({ campaign: 1, status: 1, createdAt: -1 });
CampaignMessageSchema.index({ whatsappMessageId: 1 }, { unique: true, sparse: true });
CampaignMessageSchema.index({ workspace: 1, createdAt: -1 });

CampaignMessageSchema.pre<ICampaignMessageDocument>('save', function() { this.updatedAt = new Date(); });

CampaignMessageSchema.statics.getStatusCounts = async function(campaignId) {
  const counts = await this.aggregate([
    { $match: { campaign: new mongoose.Types.ObjectId(campaignId as string) } },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);
  return counts.reduce((acc: any, item: any) => { acc[item._id] = item.count; return acc; }, {});
};

CampaignMessageSchema.statics.findByWhatsAppId = function(whatsappMessageId: string) {
  return this.findOne({ whatsappMessageId });
};

export const CampaignMessage = (mongoose.models.CampaignMessage as ICampaignMessageModel) || mongoose.model<ICampaignMessageDocument, ICampaignMessageModel>('CampaignMessage', CampaignMessageSchema);
