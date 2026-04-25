import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface ICampaignMessage {
  workspace: Types.ObjectId;
  campaign: Types.ObjectId;
  message?: Types.ObjectId;
  contact: Types.ObjectId;
  phone?: string;
  
  status: 'pending' | 'queued' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: Date;
  lastError?: string;
  errorCode?: string;
  
  whatsappMessageId?: string;
  
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

export interface ICampaignMessageDocument extends ICampaignMessage, Document {
  canRetry(): boolean;
  updateStatus(newStatus: string, timestamp?: Date): Promise<ICampaignMessageDocument>;
}

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
  
  status: { type: String, enum: ['pending', 'queued', 'sending', 'sent', 'delivered', 'read', 'failed'], default: 'queued', index: true },
  
  attempts: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 3 },
  lastAttemptAt: { type: Date },
  lastError: { type: String },
  errorCode: { type: String },
  
  whatsappMessageId: { type: String },
  
  queuedAt: { type: Date },
  sentAt: { type: Date },
  deliveredAt: { type: Date },
  readAt: { type: Date },
  repliedAt: { type: Date },
  failedAt: { type: Date },
  failureReason: { type: String },
  
  batchId: { type: Schema.Types.ObjectId, ref: 'CampaignBatch' },
  batchIndex: { type: Number },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

CampaignMessageSchema.index({ campaign: 1, contact: 1 }, { unique: true });
CampaignMessageSchema.index({ campaign: 1, status: 1 });
CampaignMessageSchema.index({ whatsappMessageId: 1 }, { sparse: true });
CampaignMessageSchema.index({ workspace: 1, createdAt: -1 });
CampaignMessageSchema.index({ workspace: 1, contact: 1, sentAt: -1 });

CampaignMessageSchema.pre<ICampaignMessageDocument>('save', function() {
  this.updatedAt = new Date();
  
});

CampaignMessageSchema.methods.canRetry = function(this: ICampaignMessageDocument) {
  return this.status === 'failed' && this.attempts < this.maxAttempts;
};

CampaignMessageSchema.methods.updateStatus = function(this: ICampaignMessageDocument, newStatus: string, timestamp = new Date()) {
  this.status = newStatus as any;
  switch (newStatus) {
    case 'queued': this.queuedAt = timestamp; break;
    case 'sent': this.sentAt = timestamp; break;
    case 'delivered': this.deliveredAt = timestamp; break;
    case 'read': this.readAt = timestamp; break;
    case 'failed': this.failedAt = timestamp; break;
  }
  return this.save();
};

CampaignMessageSchema.statics.getStatusCounts = async function(campaignId) {
  const counts = await this.aggregate([
    { $match: { campaign: new mongoose.Types.ObjectId(campaignId as string) } },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);
  return counts.reduce((acc: any, item: any) => {
    acc[item._id] = item.count;
    return acc;
  }, {});
};

CampaignMessageSchema.statics.findByWhatsAppId = function(whatsappMessageId: string) {
  return this.findOne({ whatsappMessageId });
};

export const CampaignMessage = (mongoose.models.CampaignMessage as ICampaignMessageModel) || mongoose.model<ICampaignMessageDocument, ICampaignMessageModel>('CampaignMessage', CampaignMessageSchema);
