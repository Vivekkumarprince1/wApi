import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface ICampaignBatchRecipient {
  contactId?: Types.ObjectId;
  phone?: string;
  status: 'pending' | 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
  messageId?: string;
  error?: string;
  processedAt?: Date;
}

export interface ICampaignBatch {
  workspace: Types.ObjectId;
  campaign: Types.ObjectId;
  batchIndex: number;
  totalBatches: number;
  jobId?: string;
  recipients: ICampaignBatchRecipient[];
  recipientCount: number;
  status: 'PENDING' | 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'PAUSED';
  stats: { sent: number; delivered: number; read: number; failed: number };
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: Date;
  lastError?: string;
  errorCode?: string;
  queuedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  templateId?: Types.ObjectId;
  templateName?: string;
  variableMapping?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICampaignBatchDocument extends ICampaignBatch, Document {
  markStarted(): Promise<this>;
  markCompleted(): Promise<this>;
  updateRecipientStatus(contactId: string, status: string, messageId?: string, error?: string): Promise<this>;
}
export interface ICampaignBatchModel extends Model<ICampaignBatchDocument> {
  createBatches(campaignId: any, workspaceId: any, contacts: any[], templateId: any, templateName: string, variableMapping: any, batchSize?: number): Promise<any>;
  getNextPendingBatch(campaignId: any): Promise<ICampaignBatchDocument | null>;
  getCampaignBatchStats(campaignId: any): Promise<any>;
}

const CampaignBatchSchema = new Schema<ICampaignBatchDocument, ICampaignBatchModel>({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  campaign: { type: Schema.Types.ObjectId, ref: 'Campaign', required: true, index: true },
  batchIndex: { type: Number, required: true },
  totalBatches: { type: Number, required: true },
  jobId: { type: String },
  recipients: [{ contactId: { type: Schema.Types.ObjectId, ref: 'Contact' }, phone: String, status: { type: String, enum: ['pending','queued','sent','delivered','read','failed'], default: 'pending' }, messageId: String, error: String, processedAt: Date }],
  recipientCount: { type: Number, default: 0 },
  status: { type: String, enum: ['PENDING','QUEUED','PROCESSING','COMPLETED','FAILED','PAUSED'], default: 'PENDING', index: true },
  stats: { sent: { type: Number, default: 0 }, delivered: { type: Number, default: 0 }, read: { type: Number, default: 0 }, failed: { type: Number, default: 0 } },
  attempts: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 3 },
  lastAttemptAt: Date, lastError: String, errorCode: String,
  queuedAt: Date, startedAt: Date, completedAt: Date,
  templateId: { type: Schema.Types.ObjectId, ref: 'Template' },
  templateName: String,
  variableMapping: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

CampaignBatchSchema.index({ campaign: 1, batchIndex: 1 }, { unique: true });
CampaignBatchSchema.index({ campaign: 1, status: 1 });
CampaignBatchSchema.index({ campaign: 1, status: 1, batchIndex: 1 });

CampaignBatchSchema.pre<ICampaignBatchDocument>('save', function() {
  this.updatedAt = new Date();
  this.recipientCount = this.recipients?.length || 0;
});

CampaignBatchSchema.methods.markStarted = async function() {
  this.status = 'PROCESSING';
  this.startedAt = new Date();
  this.attempts += 1;
  this.lastAttemptAt = new Date();
  return this.save();
};

CampaignBatchSchema.methods.markCompleted = async function() {
  this.status = 'COMPLETED';
  this.completedAt = new Date();
  return this.save();
};

CampaignBatchSchema.methods.updateRecipientStatus = async function(contactId: string, status: string, messageId?: string, error?: string) {
  const recipient = this.recipients.find((r: any) => r.contactId?.toString() === contactId);
  if (recipient) {
    recipient.status = status;
    recipient.processedAt = new Date();
    if (messageId) recipient.messageId = messageId;
    if (error) recipient.error = error;
    
    // Update batch stats
    if (status === 'sent') this.stats.sent += 1;
    if (status === 'failed') this.stats.failed += 1;
    if (status === 'delivered') this.stats.delivered += 1;
    if (status === 'read') this.stats.read += 1;
    
    return this.save();
  }
};

CampaignBatchSchema.statics.createBatches = async function(campaignId, workspaceId, contacts, templateId, templateName, variableMapping, batchSize = 50) {
  const batches: any[] = [];
  const totalBatches = Math.ceil(contacts.length / batchSize);
  for (let i = 0; i < contacts.length; i += batchSize) {
    const chunk = contacts.slice(i, i + batchSize);
    batches.push(new this({ workspace: workspaceId, campaign: campaignId, batchIndex: Math.floor(i / batchSize), totalBatches, recipients: chunk.map((c: any) => ({ contactId: c._id, phone: c.phone, status: 'pending' })), recipientCount: chunk.length, templateId, templateName, variableMapping, status: 'PENDING' }));
  }
  return this.insertMany(batches);
};

CampaignBatchSchema.statics.getNextPendingBatch = function(campaignId) {
  return this.findOne({ campaign: campaignId, status: { $in: ['PENDING', 'QUEUED'] } }).sort({ batchIndex: 1 });
};

CampaignBatchSchema.statics.getCampaignBatchStats = async function(campaignId) {
  const stats = await this.aggregate([
    { $match: { campaign: new mongoose.Types.ObjectId(campaignId as string) } },
    { $group: { _id: null, totalBatches: { $sum: 1 }, completedBatches: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } }, failedBatches: { $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] } }, totalSent: { $sum: '$stats.sent' }, totalDelivered: { $sum: '$stats.delivered' }, totalRead: { $sum: '$stats.read' }, totalFailed: { $sum: '$stats.failed' } } }
  ]);
  return stats[0] || { totalBatches: 0, completedBatches: 0, failedBatches: 0, totalSent: 0, totalDelivered: 0, totalRead: 0, totalFailed: 0 };
};

export const CampaignBatch = (mongoose.models.CampaignBatch as ICampaignBatchModel) || mongoose.model<ICampaignBatchDocument, ICampaignBatchModel>('CampaignBatch', CampaignBatchSchema);
