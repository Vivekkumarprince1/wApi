import mongoose, { Document, Schema } from 'mongoose';

// Simple phone normalizer matching monolith logic
export function normalizePhoneNumber(phone: string, defaultCountryCode = '91') {
  if (!phone) return '';
  let cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.length === 10) cleaned = `${defaultCountryCode}${cleaned}`;
  return cleaned;
}

export interface IContactMetadata {
  firstName?: string;
  lastName?: string;
  email?: string;
  whatsappName?: string;
  [key: string]: any;
}

export interface IOptOut {
  status: boolean;
  optedOutAt?: Date;
  optedOutVia?: 'keyword' | 'manual' | 'webhook' | null;
  optedBackInAt?: Date;
}

export interface IContact {
  workspace: mongoose.Types.ObjectId;
  name?: string;
  phone: string;
  tags: string[];
  customFields?: Map<string, any>;
  leadStatus: string;
  metadata: IContactMetadata;
  activeDealId?: mongoose.Types.ObjectId;
  activePipelineId?: mongoose.Types.ObjectId;
  assignedAgentId?: mongoose.Types.ObjectId;
  lastInboundAt?: Date;
  lastOutboundAt?: Date;
  optOut: IOptOut;
  isColdContact: boolean;
}

export interface IContactDocument extends IContact, Document {
  displayName: string;
}

const ContactSchema = new Schema<IContactDocument>({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
  name: { type: String },
  phone: { type: String, required: true },
  tags: [String],
  customFields: { type: Map, of: Schema.Types.Mixed, default: {} },
  leadStatus: { type: String, default: 'new' },
  metadata: { 
    type: Object, 
    default: {},
    firstName: String,
    lastName: String,
    email: String,
    whatsappName: String
  },
  activeDealId: { type: Schema.Types.ObjectId },
  activePipelineId: { type: Schema.Types.ObjectId },
  assignedAgentId: { type: Schema.Types.ObjectId },
  lastInboundAt: { type: Date },
  lastOutboundAt: { type: Date },
  optOut: {
    status: { type: Boolean, default: false },
    optedOutAt: { type: Date },
    optedOutVia: { type: String, enum: ['keyword', 'manual', 'webhook'], default: null },
    optedBackInAt: { type: Date }
  },
  isColdContact: { type: Boolean, default: true },
}, {
  timestamps: true,
  toObject: { virtuals: true },
  toJSON: { virtuals: true }
});

ContactSchema.index({ workspace: 1, phone: 1 }, { unique: true });

ContactSchema.virtual('displayName').get(function(this: IContactDocument) {
  const isValid = (val?: string) => val && val.trim() && val.toLowerCase() !== 'unknown';
  if (isValid(this.name)) return this.name!.trim();
  if (isValid(this.metadata?.whatsappName)) return this.metadata!.whatsappName!.trim();
  return this.phone;
});

ContactSchema.pre<IContactDocument>('save', function () {
  if (this.phone) {
    this.phone = normalizePhoneNumber(this.phone);
  }
});

export const Contact = mongoose.models.Contact || mongoose.model<IContactDocument>('Contact', ContactSchema);

const TagSchema = new Schema({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
  name: { type: String, required: true, trim: true, maxlength: 50 },
  normalizedName: { type: String, lowercase: true, trim: true },
  color: { type: String, default: '#6B7280' },
  description: { type: String, maxlength: 200 },
  scope: { type: String, enum: ['all', 'contacts', 'conversations'], default: 'all' },
  usageCount: {
    contacts: { type: Number, default: 0 },
    conversations: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  isSystem: { type: Boolean, default: false },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

TagSchema.index({ workspace: 1, normalizedName: 1 }, { unique: true });
TagSchema.pre('save', function () {
  if (this.name) this.normalizedName = String(this.name).toLowerCase().trim();
});

export const Tag = mongoose.models.Tag || mongoose.model('Tag', TagSchema);

const QuickReplySchema = new Schema({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
  name: { type: String, required: true },
  shortcut: { type: String },
  content: { type: String, required: true },
  mediaUrl: { type: String },
  mediaType: { type: String },
  variables: [{
    name: { type: String },
    fallback: { type: String }
  }],
  isActive: { type: Boolean, default: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  owner: { type: Schema.Types.ObjectId, ref: 'User' },
  scope: { type: String, enum: ['workspace', 'personal'], default: 'workspace' },
}, { timestamps: true });

QuickReplySchema.index({ workspace: 1, scope: 1, owner: 1 });
QuickReplySchema.index({ workspace: 1, name: 1, scope: 1, owner: 1 }, { unique: true });
QuickReplySchema.index({ workspace: 1, shortcut: 1 });

export const QuickReply = mongoose.models.QuickReply || mongoose.model('QuickReply', QuickReplySchema);

// Form Submission Schema
const FormSubmissionSchema = new Schema({
  workspace: { type: Schema.Types.ObjectId, required: true },
  contact: { type: Schema.Types.ObjectId, ref: 'Contact', required: true },
  formId: { type: String, required: true },
  answers: Schema.Types.Mixed,
}, { timestamps: true });

export const FormSubmission = mongoose.models.FormSubmission || mongoose.model('FormSubmission', FormSubmissionSchema);

// Pipeline Schema
const PipelineSchema = new Schema({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
  name: { type: String, required: true },
  description: { type: String },
  stages: [
    {
      id: { type: String, required: true },
      title: { type: String, required: true },
      position: { type: Number, required: true },
      isFinal: { type: Boolean, default: false },
      color: { type: String, default: '#6B7280' }
    }
  ],
  isDefault: { type: Boolean, default: false },
}, { timestamps: true });

PipelineSchema.index({ workspace: 1, name: 1 }, { unique: true });
PipelineSchema.index({ workspace: 1, isDefault: 1 });

export const Pipeline = mongoose.models.Pipeline || mongoose.model('Pipeline', PipelineSchema);

// Deal Schema
const DealSchema = new Schema({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
  contact: { type: Schema.Types.ObjectId, ref: 'Contact', required: true },
  pipeline: { type: Schema.Types.ObjectId, ref: 'Pipeline', required: true },
  title: { type: String, required: true },
  description: { type: String },
  value: { type: Number, default: 0 },
  currency: { type: String, default: 'INR' },
  stage: { type: String, required: true },
  assignedAgent: { type: Schema.Types.ObjectId },
  status: { 
    type: String, 
    enum: ['active', 'won', 'lost', 'archived'],
    default: 'active'
  },
  probability: { type: Number, min: 0, max: 100, default: 10 },
  expectedCloseDate: { type: Date },
  priority: { 
    type: String, 
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium' 
  },
  winLossReason: { type: String },
  source: { 
    type: String, 
    default: 'manual' 
  },
  sourceId: { type: Schema.Types.ObjectId },
  notes: [
    {
      text: String,
      author: { type: Schema.Types.ObjectId },
      createdAt: { type: Date, default: Date.now }
    }
  ],
  stageHistory: [
    {
      stage: String,
      timestamp: { type: Date, default: Date.now },
      changedBy: { type: Schema.Types.ObjectId }
    }
  ],
  activityLog: [
    {
      type: { type: String },
      text: String,
      payload: Schema.Types.Mixed,
      author: { type: Schema.Types.ObjectId },
      timestamp: { type: Date, default: Date.now }
    }
  ],
  attributes: { type: Object, default: {} },
  closedAt: { type: Date }
}, { timestamps: true });

DealSchema.index({ workspace: 1, contact: 1 });
DealSchema.index({ workspace: 1, stage: 1 });
DealSchema.index({ workspace: 1, status: 1 });
DealSchema.index({ pipeline: 1, stage: 1 });

export const Deal = mongoose.models.Deal || mongoose.model('Deal', DealSchema);

// Task Schema
const TaskSchema = new Schema({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
  title: { type: String, required: true },
  description: { type: String },
  type: {
    type: String,
    enum: ['Call', 'WhatsApp', 'Meeting', 'Email', 'Follow-up'],
    default: 'Follow-up'
  },
  dueDate: { type: Date },
  priority: { 
    type: String, 
    enum: ['Low', 'Medium', 'High'],
    default: 'Medium'
  },
  status: { 
    type: String, 
    enum: ['Pending', 'In Progress', 'Completed'],
    default: 'Pending'
  },
  assignee: { type: Schema.Types.ObjectId },
  relatedDeal: { type: Schema.Types.ObjectId, ref: 'Deal' },
  relatedContact: { type: Schema.Types.ObjectId, ref: 'Contact' },
  reminders: [{
    timestamp: { type: Date },
    sent: { type: Boolean, default: false }
  }],
  completedAt: { type: Date }
}, { timestamps: true });

TaskSchema.pre('save', function() {
  if (this.isModified('status') && this.status === 'Completed') {
    this.completedAt = new Date();
  }
});

TaskSchema.index({ workspace: 1, assignee: 1 });
TaskSchema.index({ workspace: 1, status: 1 });
TaskSchema.index({ workspace: 1, dueDate: 1 });
TaskSchema.index({ relatedDeal: 1 });
TaskSchema.index({ relatedContact: 1 });

export const Task = mongoose.models.Task || mongoose.model('Task', TaskSchema);

// ImportJob Schema for tracking CSV imports in the database
const ImportJobSchema = new Schema({
  jobId: { type: String, required: true, unique: true, index: true },
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  fileName: { type: String, required: true },
  totalRows: { type: Number, default: 0 },
  processedRows: { type: Number, default: 0 },
  successfulRows: { type: Number, default: 0 },
  failedRows: { type: Number, default: 0 },
  errors: [{
    row: Number,
    error: String
  }],
  status: { type: String, enum: ['started', 'in-progress', 'completed', 'failed'], default: 'started' },
  startedAt: { type: Date, default: Date.now },
  completedAt: Date
}, { timestamps: true });

export const ImportJob = mongoose.models.ImportJob || mongoose.model('ImportJob', ImportJobSchema);

// ActivityLog — workspace-scoped audit trail in the shared wapi DB (monolith
// parity). Same schema as chat-service's; the analytics dashboard reads it.
const ActivityLogSchema = new Schema({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  action: {
    type: String,
    required: true,
    enum: ['create', 'read', 'update', 'delete', 'send', 'execute', 'login', 'export', 'import'],
    index: true
  },
  entityType: {
    type: String,
    required: true,
    enum: [
      'contact', 'message', 'conversation', 'campaign',
      'automation', 'deal', 'task', 'template', 'integration',
      'workspace', 'user', 'permission', 'settings'
    ],
    index: true
  },
  entityId: { type: Schema.Types.ObjectId, sparse: true, index: true },
  entityName: String,
  changes: {
    before: Schema.Types.Mixed,
    after: Schema.Types.Mixed
  },
  status: { type: String, enum: ['success', 'failed'], default: 'success', index: true },
  errorDetails: String,
  ipAddress: String,
  userAgent: String,
  timestamp: { type: Date, default: Date.now },
  metadata: Schema.Types.Mixed
}, { timestamps: false });

ActivityLogSchema.index({ workspace: 1, timestamp: -1 });
ActivityLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7776000 }); // 90 days

export const ActivityLog = mongoose.models.ActivityLog || mongoose.model('ActivityLog', ActivityLogSchema);
