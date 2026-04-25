import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface ICampaignBatchRecipient {
  contactId?: Types.ObjectId;
  phone?: string;
  status: 'pending' | 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
  messageId?: string;
  error?: string;
  processedAt?: Date;
}

export interface ICampaignBatchStats {
  sent: number;
  delivered: number;
  read: number;
  failed: number;
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
  
  stats: ICampaignBatchStats;
  
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  variableMapping?: any;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface ICampaignBatchDocument extends ICampaignBatch, Document {
  markStarted(): Promise<ICampaignBatchDocument>;
  markCompleted(): Promise<ICampaignBatchDocument>;
  markFailed(error: string, errorCode?: string | null): Promise<ICampaignBatchDocument>;
  updateRecipientStatus(contactId: string | Types.ObjectId, status: string, messageId?: string | null, error?: string | null): Promise<ICampaignBatchDocument>;
  canRetry(): boolean;
  getPendingRecipients(): ICampaignBatchRecipient[];
}

export interface ICampaignBatchModel extends Model<ICampaignBatchDocument> {
  createBatches(campaignId: string | Types.ObjectId, workspaceId: string | Types.ObjectId, contacts: any[], templateId: string | Types.ObjectId, templateName: string, variableMapping: any, batchSize?: number): Promise<any>;
  getNextPendingBatch(campaignId: string | Types.ObjectId): Promise<ICampaignBatchDocument | null>;
  getCampaignBatchStats(campaignId: string | Types.ObjectId): Promise<any>;
}

const CampaignBatchSchema = new Schema<ICampaignBatchDocument, ICampaignBatchModel>({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  campaign: { type: Schema.Types.ObjectId, ref: 'Campaign', required: true, index: true },
  batchIndex: { type: Number, required: true },
  totalBatches: { type: Number, required: true },
  jobId: { type: String },
  
  recipients: [{
    contactId: { type: Schema.Types.ObjectId, ref: 'Contact' },
    phone: { type: String },
    status: { type: String, enum: ['pending', 'queued', 'sent', 'delivered', 'read', 'failed'], default: 'pending' },
    messageId: { type: String },
    error: { type: String },
    processedAt: { type: Date }
  }],
  
  recipientCount: { type: Number, default: 0 },
  status: { type: String, enum: ['PENDING', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'PAUSED'], default: 'PENDING', index: true },
  
  stats: {
    sent: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    read: { type: Number, default: 0 },
    failed: { type: Number, default: 0 }
  },
  
  attempts: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 3 },
  lastAttemptAt: { type: Date },
  lastError: { type: String },
  errorCode: { type: String },
  
  queuedAt: { type: Date },
  startedAt: { type: Date },
  completedAt: { type: Date },
  
  templateId: { type: Schema.Types.ObjectId, ref: 'Template' },
  templateName: { type: String },
  variableMapping: { type: Schema.Types.Mixed, default: {} },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

CampaignBatchSchema.index({ campaign: 1, batchIndex: 1 }, { unique: true });
CampaignBatchSchema.index({ campaign: 1, status: 1 });
CampaignBatchSchema.index({ workspace: 1, status: 1, createdAt: -1 });
CampaignBatchSchema.index({ jobId: 1 }, { sparse: true });

CampaignBatchSchema.pre<ICampaignBatchDocument>('save', function() {
  this.updatedAt = new Date();
  this.recipientCount = this.recipients?.length || 0;
  
});

CampaignBatchSchema.methods.markStarted = function(this: ICampaignBatchDocument) {
  this.status = 'PROCESSING';
  this.startedAt = new Date();
  this.attempts += 1;
  this.lastAttemptAt = new Date();
  return this.save();
};

CampaignBatchSchema.methods.markCompleted = function(this: ICampaignBatchDocument) {
  this.status = 'COMPLETED';
  this.completedAt = new Date();
  return this.save();
};

CampaignBatchSchema.methods.markFailed = function(this: ICampaignBatchDocument, error: string, errorCode: string | null = null) {
  this.status = 'FAILED';
  this.lastError = error;
  if (errorCode) this.errorCode = errorCode;
  this.completedAt = new Date();
  return this.save();
};

CampaignBatchSchema.methods.updateRecipientStatus = function(this: ICampaignBatchDocument, contactId: string | Types.ObjectId, status: any, messageId: string | null = null, error: string | null = null) {
  const recipient = this.recipients.find(r => r.contactId?.toString() === contactId.toString());
  if (recipient) {
    recipient.status = status;
    recipient.processedAt = new Date();
    if (messageId) recipient.messageId = messageId;
    if (error) recipient.error = error;
    if (status === 'sent') this.stats.sent += 1;
    else if (status === 'failed') this.stats.failed += 1;
    else if (status === 'delivered') this.stats.delivered += 1;
    else if (status === 'read') this.stats.read += 1;
  }
  return this.save();
};

CampaignBatchSchema.methods.canRetry = function(this: ICampaignBatchDocument) {
  return this.status === 'FAILED' && this.attempts < this.maxAttempts;
};

CampaignBatchSchema.methods.getPendingRecipients = function(this: ICampaignBatchDocument) {
  return this.recipients.filter(r => r.status === 'pending' || r.status === 'queued');
};

CampaignBatchSchema.statics.createBatches = async function(campaignId, workspaceId, contacts, templateId, templateName, variableMapping, batchSize = 50) {
  const batches: any[] = [];
  const totalBatches = Math.ceil(contacts.length / batchSize);
  for (let i = 0; i < contacts.length; i += batchSize) {
    const batchContacts = contacts.slice(i, i + batchSize);
    batches.push(new this({
      workspace: workspaceId,
      campaign: campaignId,
      batchIndex: Math.floor(i / batchSize),
      totalBatches,
      recipients: batchContacts.map((c: any) => ({ contactId: c._id, phone: c.phone, status: 'pending' })),
      recipientCount: batchContacts.length,
      templateId,
      templateName,
      variableMapping,
      status: 'PENDING'
    }));
  }
  return this.insertMany(batches);
};

CampaignBatchSchema.statics.getNextPendingBatch = function(campaignId) {
  return this.findOne({ campaign: campaignId, status: { $in: ['PENDING', 'QUEUED'] } }).sort({ batchIndex: 1 });
};

CampaignBatchSchema.statics.getCampaignBatchStats = async function(campaignId) {
  const stats = await this.aggregate([
    { $match: { campaign: new mongoose.Types.ObjectId(campaignId as string) } },
    { $group: {
      _id: null,
      totalBatches: { $sum: 1 },
      completedBatches: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } },
      failedBatches: { $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] } },
      processingBatches: { $sum: { $cond: [{ $eq: ['$status', 'PROCESSING'] }, 1, 0] } },
      pendingBatches: { $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] } },
      totalSent: { $sum: '$stats.sent' },
      totalDelivered: { $sum: '$stats.delivered' },
      totalRead: { $sum: '$stats.read' },
      totalFailed: { $sum: '$stats.failed' }
    } }
  ]);
  return stats[0] || {
    totalBatches: 0, completedBatches: 0, failedBatches: 0, processingBatches: 0, pendingBatches: 0, totalSent: 0, totalDelivered: 0, totalRead: 0, totalFailed: 0
  };
};

export const CampaignBatch = (mongoose.models.CampaignBatch as ICampaignBatchModel) || mongoose.model<ICampaignBatchDocument, ICampaignBatchModel>('CampaignBatch', CampaignBatchSchema);
