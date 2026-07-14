import mongoose, { Document, Schema, Model, Types } from 'mongoose';

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-SCHEMAS & INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ICampaignTotals {
  totalRecipients: number;
  queued: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  replied: number;
}

export interface ICampaignBatching {
  totalBatches: number;
  completedBatches: number;
  failedBatches: number;
  currentBatchIndex: number;
  batchSize: number;
  lastBatchProcessedAt?: Date;
}

export interface ICampaignFailureTracking {
  consecutiveFailures: number;
  failureRate: number;
  lastFailureAt?: Date;
  lastFailureError?: string;
  metaErrorCodes?: string[];
}

export interface ICampaignExecution {
  startedBy?: Types.ObjectId;
  pausedBy?: Types.ObjectId;
  resumedBy?: Types.ObjectId;
  lastResumedAt?: Date;
  resumeCount: number;
}

export interface ICampaignAuditHistory {
  action: 'CREATED' | 'STARTED' | 'PAUSED' | 'RESUMED' | 'COMPLETED' | 'FAILED' | 'SYSTEM_PAUSED' | 'BATCH_COMPLETED';
  by?: Types.ObjectId;
  at: Date;
  reason?: string;
  systemInitiated: boolean;
  meta?: Record<string, unknown>;
}

export interface ICampaignAudit {
  startedBy?: Types.ObjectId;
  startedAt?: Date;
  pausedBy?: Types.ObjectId;
  pausedAt?: Date;
  resumedBy?: Types.ObjectId;
  resumedAt?: Date;
  systemPaused: boolean;
  lastSystemPauseReason?: 'QUALITY_DEGRADED' | 'TIER_DOWNGRADED' | 'ENFORCEMENT_DETECTED' | 'HIGH_FAILURE_RATE' | 'TOKEN_EXPIRED' | 'ACCOUNT_BLOCKED' | 'KILL_SWITCH_ACTIVATED' | null;
  lastSystemPauseAt?: Date;
  history: ICampaignAuditHistory[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN CAMPAIGN INTERFACE
// ═══════════════════════════════════════════════════════════════════════════════

export interface ICampaign {
  workspace: Types.ObjectId;
  name: string;
  description?: string;
  campaignType: 'one-time' | 'scheduled';
  
  template: Types.ObjectId;
  templateSnapshot?: {
    name?: string;
    category?: string;
    language?: string;
    variables?: string[];
    headerType?: string;
    bodyText?: string;
  };
  
  message?: string;
  messageTemplate?: string;
  variableMapping?: any;
  
  contacts: Types.ObjectId[];
  recipientFilter?: {
    type: 'all' | 'tags' | 'custom' | 'segment' | 'specific';
    tags?: string[];
    segmentId?: Types.ObjectId;
    customFilter?: any;
  };
  
  status: 'DRAFT' | 'SCHEDULED' | 'QUEUED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'PARTIALLY_COMPLETED' | 'FAILED' | 'CANCELLED' | 'draft' | 'queued' | 'sending' | 'completed' | 'paused' | 'failed';
  
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  scheduleAt?: Date;
  
  totals: ICampaignTotals;
  totalContacts: number;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  readCount: number;
  repliedCount: number;
  
  batching: ICampaignBatching;
  
  pausedReason?: 'USER_PAUSED' | 'LIMIT_REACHED' | 'TEMPLATE_REVOKED' | 'ACCOUNT_BLOCKED' | 'ACCOUNT_DISABLED' | 'TOKEN_EXPIRED' | 'CAPABILITY_REVOKED' | 'HIGH_FAILURE_RATE' | 'RATE_LIMITED' | 'PHONE_DISCONNECTED' | null;
  pausedAt?: Date | null;
  
  failureTracking: ICampaignFailureTracking;
  execution: ICampaignExecution;
  audit: ICampaignAudit;
  
  createdBy?: Types.ObjectId;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICampaignDocument extends ICampaign, Document {
  canStart(): boolean;
  canPause(): boolean;
  canResume(): boolean;
  getProgress(): number;
  getDeliveryRate(): number;
  getReadRate(): number;
}

export interface ICampaignModel extends Model<ICampaignDocument> {
  incrementTotal(campaignId: Types.ObjectId | string, field: string, value?: number): Promise<ICampaignDocument>;
  addAuditEntry(campaignId: Types.ObjectId | string, action: string, options?: any): Promise<ICampaignDocument>;
  systemPause(campaignId: Types.ObjectId | string, reason: string): Promise<ICampaignDocument>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MONGOOSE SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

const CampaignSchema = new Schema<ICampaignDocument, ICampaignModel>({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  name: { type: String, required: true },
  description: { type: String },
  campaignType: { type: String, enum: ['one-time', 'scheduled'], default: 'one-time' },
  
  template: { type: Schema.Types.ObjectId, ref: 'Template', required: true },
  templateSnapshot: {
    name: { type: String },
    category: { type: String },
    language: { type: String },
    variables: [String],
    headerType: { type: String },
    bodyText: { type: String }
  },
  
  message: { type: String },
  messageTemplate: { type: String },
  variableMapping: { type: Schema.Types.Mixed, default: {} },
  
  contacts: [{ type: Schema.Types.ObjectId, ref: 'Contact' }],
  recipientFilter: {
    type: { type: String, enum: ['all', 'tags', 'custom', 'segment', 'specific'] },
    tags: [String],
    segmentId: { type: Schema.Types.ObjectId, ref: 'Segment' },
    customFilter: { type: Schema.Types.Mixed }
  },
  
  status: { type: String, default: 'DRAFT', index: true },
  
  scheduledAt: { type: Date },
  startedAt: { type: Date },
  completedAt: { type: Date },
  scheduleAt: { type: Date },
  
  totals: {
    totalRecipients: { type: Number, default: 0 },
    queued: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    read: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    replied: { type: Number, default: 0 }
  },
  
  totalContacts: { type: Number, default: 0 },
  sentCount: { type: Number, default: 0 },
  deliveredCount: { type: Number, default: 0 },
  failedCount: { type: Number, default: 0 },
  readCount: { type: Number, default: 0 },
  repliedCount: { type: Number, default: 0 },
  
  batching: {
    totalBatches: { type: Number, default: 0 },
    completedBatches: { type: Number, default: 0 },
    failedBatches: { type: Number, default: 0 },
    currentBatchIndex: { type: Number, default: 0 },
    batchSize: { type: Number, default: 50 },
    lastBatchProcessedAt: { type: Date }
  },
  
  pausedReason: { type: String, default: null },
  pausedAt: { type: Date, default: null },
  
  failureTracking: {
    consecutiveFailures: { type: Number, default: 0 },
    failureRate: { type: Number, default: 0 },
    lastFailureAt: { type: Date },
    lastFailureError: { type: String },
    metaErrorCodes: [String]
  },
  
  execution: {
    startedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    pausedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    resumedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    lastResumedAt: { type: Date },
    resumeCount: { type: Number, default: 0 }
  },
  
  audit: {
    startedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    startedAt: { type: Date },
    pausedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    pausedAt: { type: Date },
    resumedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    resumedAt: { type: Date },
    systemPaused: { type: Boolean, default: false },
    lastSystemPauseReason: { type: String, default: null },
    lastSystemPauseAt: { type: Date },
    history: [{
      action: { type: String },
      by: { type: Schema.Types.ObjectId, ref: 'User' },
      at: { type: Date, default: Date.now },
      reason: { type: String },
      systemInitiated: { type: Boolean, default: false },
      meta: { type: Schema.Types.Mixed }
    }]
  },
  
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    metadata: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes
CampaignSchema.index({ workspace: 1, status: 1 });
CampaignSchema.index({ workspace: 1, createdAt: -1 });
CampaignSchema.index({ workspace: 1, scheduledAt: 1, status: 1 });
CampaignSchema.index({ status: 1, scheduledAt: 1 });
CampaignSchema.index({ status: 1, updatedAt: 1 });
CampaignSchema.index(
  { workspace: 1, 'metadata.idempotencyKey': 1 },
  { unique: true, partialFilterExpression: { 'metadata.idempotencyKey': { $type: 'string' } } },
);

CampaignSchema.pre<ICampaignDocument>('save', function() {
  this.updatedAt = new Date();
  
  if (this.isModified('totals')) {
    this.totalContacts = this.totals.totalRecipients || this.totalContacts;
    this.sentCount = this.totals.sent || this.sentCount;
    this.deliveredCount = this.totals.delivered || this.deliveredCount;
    this.failedCount = this.totals.failed || this.failedCount;
    this.readCount = this.totals.read || this.readCount;
    this.repliedCount = this.totals.replied || this.repliedCount;
  }
  
  if (this.status && this.status === this.status.toLowerCase()) {
    const statusMap: Record<string, any> = {
      'draft': 'DRAFT',
      'queued': 'QUEUED',
      'sending': 'RUNNING',
      'completed': 'COMPLETED',
      'paused': 'PAUSED',
      'failed': 'FAILED'
    };
    if (statusMap[this.status]) {
      this.status = statusMap[this.status];
    }
  }
});

// Instance Methods
CampaignSchema.methods.canStart = function() {
  return ['DRAFT', 'SCHEDULED', 'PAUSED'].includes(this.status);
};

CampaignSchema.methods.canPause = function() {
  return ['RUNNING'].includes(this.status);
};

CampaignSchema.methods.canResume = function() {
  return ['PAUSED'].includes(this.status);
};

CampaignSchema.methods.getProgress = function() {
  const total = this.totals?.totalRecipients || 0;
  if (total === 0) return 0;
  const processed = (this.totals?.sent || 0) + (this.totals?.failed || 0);
  return Math.round((processed / total) * 100);
};

CampaignSchema.methods.getDeliveryRate = function() {
  const sent = this.totals?.sent || 0;
  if (sent === 0) return 0;
  return Math.round(((this.totals?.delivered || 0) / sent) * 100);
};

CampaignSchema.methods.getReadRate = function() {
  const delivered = this.totals?.delivered || 0;
  if (delivered === 0) return 0;
  return Math.round(((this.totals?.read || 0) / delivered) * 100);
};

// Statics
CampaignSchema.statics.incrementTotal = async function(campaignId: Types.ObjectId | string, field: string, value: number = 1) {
  const updateField = `totals.${field}`;
  const legacyFieldMap: Record<string, string> = {
    sent: 'sentCount',
    delivered: 'deliveredCount',
    read: 'readCount',
    failed: 'failedCount',
    replied: 'repliedCount',
  };

  const update: Record<string, any> = {
    $inc: { [updateField]: value },
    $set: { updatedAt: new Date() }
  };

  if (legacyFieldMap[field]) {
    update.$inc[legacyFieldMap[field]] = value;
  }

  return this.findByIdAndUpdate(
    campaignId,
    update,
    { returnDocument: 'after' }
  );
};

CampaignSchema.statics.addAuditEntry = async function(campaignId: Types.ObjectId | string, action: string, options: any = {}) {
  const { userId, reason, systemInitiated = false, meta } = options;
  const entry = { action, by: userId, at: new Date(), reason, systemInitiated, meta };
  
  return this.findByIdAndUpdate(
    campaignId,
    { 
      $push: { 'audit.history': { $each: [entry], $slice: -50 } },
      $set: { updatedAt: new Date() }
    },
    { returnDocument: 'after' }
  );
};

CampaignSchema.statics.systemPause = async function(campaignId: Types.ObjectId | string, reason: string) {
  return this.findByIdAndUpdate(
    campaignId,
    {
      $set: {
        status: 'PAUSED',
        pausedReason: reason,
        pausedAt: new Date(),
        'audit.systemPaused': true,
        'audit.lastSystemPauseReason': reason,
        'audit.lastSystemPauseAt': new Date(),
        updatedAt: new Date()
      },
      $push: {
        'audit.history': {
          $each: [{
            action: 'SYSTEM_PAUSED',
            at: new Date(),
            reason,
            systemInitiated: true
          }],
          $slice: -50
        }
      }
    },
    { returnDocument: 'after' }
  );
};

export const Campaign = (mongoose.models.Campaign as ICampaignModel) || mongoose.model<ICampaignDocument, ICampaignModel>('Campaign', CampaignSchema);
