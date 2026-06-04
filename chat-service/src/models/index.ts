import mongoose, { Schema, Document, Model, Types } from 'mongoose';

// Abstract Interface for High-Scale Timeline Storage (Cassandra / DynamoDB)
export interface ITimelineStore {
  saveMessage(msg: any): Promise<boolean>;
  getTimeline(conversationId: string, limit: number): Promise<any[]>;
}

// --- Restored Conversation Model with Methods & Interfaces ---

export interface IConversationAssignmentHistory {
  assignedTo?: Types.ObjectId;
  assignedBy?: Types.ObjectId;
  assignedAt: Date;
  action: 'assigned' | 'unassigned' | 'reassigned';
}

export interface IConversationSoftLock {
  lockedBy?: Types.ObjectId;
  lockedAt?: Date;
  expiresAt?: Date;
}

export interface IConversationBotMetadata {
  failedIntents: number;
  isBotPaused: boolean;
  lastBotInteractionAt?: Date;
}

export interface IConversation {
  workspace: Types.ObjectId;
  contact: any;
  channel: string;
  assignedTo?: Types.ObjectId;
  team?: Types.ObjectId;
  assignedBy?: Types.ObjectId;
  assignedAt?: Date;
  assignmentHistory: IConversationAssignmentHistory[];
  lastRepliedBy?: Types.ObjectId;
  lastAgentReplyAt?: Date;
  status: 'open' | 'pending' | 'resolved' | 'closed' | 'snoozed' | 'spam';
  statusChangedAt: Date;
  statusChangedBy?: Types.ObjectId;
  snoozedUntil?: Date;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  unreadCount: number;
  agentUnreadCounts: Map<string, number>;
  viewedBy: Array<{ user: Types.ObjectId; viewedAt: Date }>;
  lastMessageAt?: Date;
  lastMessagePreview?: string;
  lastMessageDirection?: 'inbound' | 'outbound';
  lastMessageType?: string;
  firstResponseAt?: Date;
  firstResponseBy?: Types.ObjectId;
  slaDeadline?: Date;
  slaBreached: boolean;
  slaBreachedAt?: Date;
  slaEscalatedAt?: Date;
  slaEscalatedTo?: Types.ObjectId;
  softLock?: IConversationSoftLock;
  lastActivityAt: Date;
  lastCustomerMessageAt?: Date;
  tags: string[];
  label?: string;
  notes?: string;
  conversationType: 'customer_initiated' | 'business_initiated';
  messageCount: number;
  templateMessageCount: number;
  freeMessageCount: number;
  conversationStartedAt: Date;
  isBillable: boolean;
  isOpen: boolean;
  windowExpiresAt?: Date;
  lastInboundAt?: Date;
  lastOutboundAt?: Date;
  wabaId?: string;
  botMetadata: IConversationBotMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface IConversationDocument extends IConversation, Document {
  assignTo(agentId: Types.ObjectId | string, assignedById: Types.ObjectId | string): IConversationDocument;
  unassign(unassignedById: Types.ObjectId | string): IConversationDocument;
  markReadForAgent(agentId: Types.ObjectId | string): IConversationDocument;
  incrementUnreadForAllAgents(): IConversationDocument;
  getUnreadForAgent(agentId: Types.ObjectId | string): number;
  updateStatus(newStatus: string, changedById?: Types.ObjectId | string): IConversationDocument;
}

export interface IConversationModel extends Model<IConversationDocument> {
  getAgentInbox(workspaceId: string | Types.ObjectId, agentId: string | Types.ObjectId, options?: any): Promise<IConversationDocument[]>;
  getAllInbox(workspaceId: string | Types.ObjectId, options?: any): Promise<IConversationDocument[]>;
  getUnassigned(workspaceId: string | Types.ObjectId, options?: any): Promise<IConversationDocument[]>;
}

const ConversationSchema = new Schema<IConversationDocument, IConversationModel>({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
  contact: { type: Schema.Types.ObjectId, ref: 'Contact', required: true },
  channel: { type: String, default: 'whatsapp' },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
  team: { type: Schema.Types.ObjectId, ref: 'Team' },
  assignedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  assignedAt: { type: Date },
  assignmentHistory: [{
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    assignedAt: { type: Date, default: Date.now },
    action: { type: String, enum: ['assigned', 'unassigned', 'reassigned'] }
  }],
  lastRepliedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  lastAgentReplyAt: { type: Date },
  status: { type: String, enum: ['open', 'pending', 'resolved', 'closed', 'snoozed', 'spam'], default: 'open' },
  statusChangedAt: { type: Date, default: Date.now },
  statusChangedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  snoozedUntil: { type: Date },
  priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
  unreadCount: { type: Number, default: 0 },
  agentUnreadCounts: { type: Map, of: Number, default: new Map() },
  viewedBy: [{
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    viewedAt: { type: Date, default: Date.now }
  }],
  lastMessageAt: { type: Date },
  lastMessagePreview: { type: String },
  lastMessageDirection: { type: String, enum: ['inbound', 'outbound'] },
  lastMessageType: { type: String },
  firstResponseAt: { type: Date },
  firstResponseBy: { type: Schema.Types.ObjectId, ref: 'User' },
  slaDeadline: { type: Date },
  slaBreached: { type: Boolean, default: false },
  slaBreachedAt: { type: Date },
  slaEscalatedAt: { type: Date },
  slaEscalatedTo: { type: Schema.Types.ObjectId, ref: 'User' },
  softLock: {
    lockedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    lockedAt: { type: Date },
    expiresAt: { type: Date }
  },
  lastActivityAt: { type: Date, default: Date.now },
  lastCustomerMessageAt: { type: Date },
  tags: [String],
  label: { type: String, maxlength: 22 },
  notes: { type: String },
  conversationType: { type: String, enum: ['customer_initiated', 'business_initiated'], default: 'customer_initiated' },
  messageCount: { type: Number, default: 0 },
  templateMessageCount: { type: Number, default: 0 },
  freeMessageCount: { type: Number, default: 0 },
  conversationStartedAt: { type: Date, default: Date.now },
  isBillable: { type: Boolean, default: true },
  isOpen: { type: Boolean, default: true },
  windowExpiresAt: { type: Date },
  lastInboundAt: { type: Date },
  lastOutboundAt: { type: Date },
  wabaId: { type: String },
  botMetadata: {
    failedIntents: { type: Number, default: 0 },
    isBotPaused: { type: Boolean, default: false },
    lastBotInteractionAt: { type: Date }
  }
}, { timestamps: true });

ConversationSchema.index({ workspace: 1, contact: 1 }, { unique: true });
ConversationSchema.index({ workspace: 1, status: 1, lastActivityAt: -1 });
ConversationSchema.index({ workspace: 1, assignedTo: 1, status: 1 });
ConversationSchema.index({ workspace: 1, assignedTo: 1, lastMessageAt: -1 });
ConversationSchema.index({ workspace: 1, team: 1, status: 1 });
ConversationSchema.index({ workspace: 1, assignedTo: 1, status: 1, lastActivityAt: -1 }, { partialFilterExpression: { assignedTo: null } });
ConversationSchema.index({ workspace: 1, priority: 1, lastActivityAt: -1 });
ConversationSchema.index({ workspace: 1, lastActivityAt: -1 });
ConversationSchema.index({ workspace: 1, conversationStartedAt: 1, isBillable: 1 });

ConversationSchema.methods.assignTo = function(this: IConversationDocument, agentId: Types.ObjectId | string, assignedById: Types.ObjectId | string) {
  const previousAssignee = this.assignedTo;
  this.assignedTo = agentId as Types.ObjectId;
  this.assignedBy = assignedById as Types.ObjectId;
  this.assignedAt = new Date();
  this.assignmentHistory.push({
    assignedTo: agentId as Types.ObjectId,
    assignedBy: assignedById as Types.ObjectId,
    assignedAt: new Date(),
    action: previousAssignee ? 'reassigned' : 'assigned'
  });
  if (!this.agentUnreadCounts.has(agentId.toString())) {
    this.agentUnreadCounts.set(agentId.toString(), this.unreadCount);
  }
  return this;
};

ConversationSchema.methods.unassign = function(this: IConversationDocument, unassignedById: Types.ObjectId | string) {
  const previousAssignee = this.assignedTo;
  if (previousAssignee) {
    this.assignmentHistory.push({
      assignedTo: undefined,
      assignedBy: unassignedById as Types.ObjectId,
      assignedAt: new Date(),
      action: 'unassigned'
    });
  }
  this.assignedTo = undefined;
  this.assignedBy = undefined;
  this.assignedAt = undefined;
  return this;
};

ConversationSchema.methods.markReadForAgent = function(this: IConversationDocument, agentId: Types.ObjectId | string) {
  this.agentUnreadCounts.set(agentId.toString(), 0);
  this.unreadCount = 0; 
  const existingView = this.viewedBy.find(v => v.user.toString() === agentId.toString());
  if (existingView) {
    existingView.viewedAt = new Date();
  } else {
    this.viewedBy.push({ user: agentId as Types.ObjectId, viewedAt: new Date() });
  }
  return this;
};

ConversationSchema.methods.incrementUnreadForAllAgents = function(this: IConversationDocument) {
  this.unreadCount += 1;
  for (const [agentId, count] of Array.from(this.agentUnreadCounts.entries())) {
    this.agentUnreadCounts.set(agentId, count + 1);
  }
  if (this.assignedTo) {
    const assigneeId = this.assignedTo.toString();
    if (!this.agentUnreadCounts.has(assigneeId)) {
      this.agentUnreadCounts.set(assigneeId, 1);
    }
  }
  return this;
};

ConversationSchema.methods.getUnreadForAgent = function(this: IConversationDocument, agentId: Types.ObjectId | string) {
  return this.agentUnreadCounts.get(agentId.toString()) || 0;
};

ConversationSchema.methods.updateStatus = function(this: IConversationDocument, newStatus: string, changedById?: Types.ObjectId | string) {
  this.status = newStatus as any;
  this.statusChangedAt = new Date();
  if (changedById) this.statusChangedBy = changedById as Types.ObjectId;
  return this;
};

// @ts-ignore
ConversationSchema.statics.getAgentInbox = async function(workspaceId, agentId, options: any = {}) {
  const { page = 1, limit = 20, status, sort = '-lastActivityAt' } = options;
  const query: any = { workspace: workspaceId, assignedTo: agentId };
  if (status) query.status = status;
  return this.find(query)
    .populate('contact', 'name phone email')
    .populate('assignedTo', 'name email')
    .sort(sort).skip((page - 1) * limit).limit(limit).lean();
};

// @ts-ignore
ConversationSchema.statics.getAllInbox = async function(workspaceId, options: any = {}) {
  const { page = 1, limit = 20, status, assignedTo, sort = '-lastActivityAt' } = options;
  const query: any = { workspace: workspaceId };
  if (status) query.status = status;
  if (assignedTo !== undefined) query.assignedTo = assignedTo === 'unassigned' ? null : assignedTo;
  return this.find(query)
    .populate('contact', 'name phone email')
    .populate('assignedTo', 'name email')
    .populate('lastRepliedBy', 'name email')
    .sort(sort).skip((page - 1) * limit).limit(limit).lean();
};

// @ts-ignore
ConversationSchema.statics.getUnassigned = async function(workspaceId, options: any = {}) {
  const { page = 1, limit = 20, sort = '-lastActivityAt' } = options;
  return this.find({
    workspace: workspaceId,
    assignedTo: null,
    status: { $in: ['open', 'pending'] }
  })
    .populate('contact', 'name phone email')
    .sort(sort).skip((page - 1) * limit).limit(limit).lean();
};

ConversationSchema.pre<IConversationDocument>('save', function () {
  this.updatedAt = new Date();
});

export const Conversation = (mongoose.models.Conversation as IConversationModel) || mongoose.model<IConversationDocument, IConversationModel>('Conversation', ConversationSchema);

// --- Message Model ---

const MessageSchema = new Schema({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
  contact: { type: Schema.Types.ObjectId, ref: 'Contact', index: true },
  sender: { type: Schema.Types.ObjectId, ref: 'User' },
  sentBy: { type: Schema.Types.ObjectId, ref: 'User' },
  direction: { type: String, enum: ['inbound', 'outbound'], required: true, index: true },
  type: { type: String, enum: ['text', 'template', 'image', 'video', 'audio', 'document', 'interactive', 'note', 'contacts', 'reaction', 'system'], default: 'text', index: true },
  text: String,
  body: String,
  mediaUrl: String,
  messageId: { type: String, unique: true, sparse: true, index: true },
  whatsappMessageId: { type: String, index: true },
  status: { type: String, enum: ['queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'received', 'unknown'], default: 'sent', index: true },
  sentAt: { type: Date, default: Date.now },
  deliveredAt: { type: Date },
  readAt: { type: Date },
  failedAt: { type: Date },
  failureReason: { type: String },
  isInternalNote: { type: Boolean, default: false, index: true },
  template: {
    id: { type: Schema.Types.ObjectId, ref: 'Template' },
    name: { type: String },
    metaTemplateName: { type: String },
    category: { type: String },
    language: { type: String },
    variables: { type: Schema.Types.Mixed },
    header: { type: Schema.Types.Mixed },
    buttons: { type: Schema.Types.Mixed }
  },
  media: {
    id: { type: String },
    url: { type: String },
    mimeType: { type: String },
    filename: { type: String },
    caption: { type: String }
  },
  campaign: {
    id: { type: Schema.Types.ObjectId, ref: 'Campaign' },
    name: { type: String },
    batchId: { type: String }
  },
  meta: { type: Schema.Types.Mixed, default: {} }
}, { timestamps: true });

MessageSchema.index({ conversation: 1, sentAt: 1 });
MessageSchema.index({ workspace: 1, 'campaign.id': 1 });

MessageSchema.methods.updateStatus = async function (newStatus: string, timestamp?: number) {
  this.status = newStatus;
  const now = timestamp ? new Date(timestamp * 1000) : new Date();

  switch (newStatus) {
    case 'sent':
      this.sentAt = this.sentAt || now;
      break;
    case 'delivered':
      this.deliveredAt = now;
      break;
    case 'read':
      this.readAt = now;
      break;
    case 'failed':
      this.failedAt = now;
      break;
  }
  return this.save();
};

export const Message = mongoose.models.Message || mongoose.model('Message', MessageSchema);

// Support Ticket Schema
const SupportTicketSchema = new Schema({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  subject: { type: String, required: true },
  description: { type: String },
  status: { type: String, enum: ['open', 'pending', 'resolved', 'closed'], default: 'open' },
  priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
  category: { type: String, default: 'general' },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  contact: { type: Schema.Types.ObjectId, ref: 'Contact' },
  lastResponseAt: { type: Date },
  resolvedAt: { type: Date },
  tags: [{ type: String }],
  metadata: { type: Schema.Types.Mixed, default: {} }
}, { timestamps: true });

export const SupportTicket = mongoose.models.SupportTicket || mongoose.model('SupportTicket', SupportTicketSchema);

// Macro Schema
const MacroSchema = new Schema({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  name: { type: String, required: true },
  shortcut: { type: String, trim: true, index: true },
  content: { type: String, required: true },
  description: { type: String },
  category: { type: String, default: 'general' },
  isActive: { type: Boolean, default: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

export const Macro = mongoose.models.Macro || mongoose.model('Macro', MacroSchema);

// --- Restored Missing Models from Monolith ---

// 1. Tag Model
export interface ITagUsageCount {
  contacts: number;
  conversations: number;
  total: number;
}

export interface ITag {
  workspace: Types.ObjectId;
  name: string;
  normalizedName: string;
  color: string;
  description?: string;
  scope: 'all' | 'contacts' | 'conversations';
  usageCount: ITagUsageCount;
  isSystem: boolean;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITagDocument extends ITag, Document { }

export interface ITagModel extends Model<ITagDocument> {
  findOrCreate(workspaceId: string | Types.ObjectId, tagName: string, userId?: string | Types.ObjectId | null): Promise<ITagDocument>;
  incrementUsage(workspaceId: string | Types.ObjectId, tagName: string, type?: string): Promise<ITagDocument | null>;
  decrementUsage(workspaceId: string | Types.ObjectId, tagName: string, type?: string): Promise<ITagDocument | null>;
  getPopularTags(workspaceId: string | Types.ObjectId, limit?: number): Promise<any[]>;
  searchByPrefix(workspaceId: string | Types.ObjectId, prefix: string, limit?: number): Promise<any[]>;
}

const TagSchema = new Schema<ITagDocument, ITagModel>({
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
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

TagSchema.index({ workspace: 1, normalizedName: 1 }, { unique: true });
TagSchema.index({ workspace: 1, createdAt: -1 });
TagSchema.index({ workspace: 1, 'usageCount.total': -1 });

TagSchema.pre<ITagDocument>('save', function () {
  this.normalizedName = this.name.toLowerCase().trim();
  this.updatedAt = new Date();
});

TagSchema.statics.findOrCreate = async function (workspaceId, tagName, userId = null) {
  const normalizedName = tagName.toLowerCase().trim();
  let tag = await this.findOne({ workspace: workspaceId, normalizedName });
  if (!tag) {
    tag = await this.create({ workspace: workspaceId, name: tagName.trim(), normalizedName, createdBy: userId });
  }
  return tag;
};

TagSchema.statics.incrementUsage = async function (workspaceId, tagName, type = 'contacts') {
  const normalizedName = tagName.toLowerCase().trim();
  const field = type === 'contacts' ? 'usageCount.contacts' : 'usageCount.conversations';
  return this.findOneAndUpdate({ workspace: workspaceId, normalizedName }, { $inc: { [field]: 1, 'usageCount.total': 1 } }, { returnDocument: 'after' });
};

TagSchema.statics.decrementUsage = async function (workspaceId, tagName, type = 'contacts') {
  const normalizedName = tagName.toLowerCase().trim();
  const field = type === 'contacts' ? 'usageCount.contacts' : 'usageCount.conversations';
  return this.findOneAndUpdate({ workspace: workspaceId, normalizedName }, { $inc: { [field]: -1, 'usageCount.total': -1 } }, { returnDocument: 'after' });
};

TagSchema.statics.getPopularTags = async function (workspaceId, limit = 20) {
  return this.find({ workspace: workspaceId }).sort({ 'usageCount.total': -1 }).limit(limit).lean();
};

TagSchema.statics.searchByPrefix = async function (workspaceId, prefix, limit = 10) {
  return this.find({ workspace: workspaceId, normalizedName: { $regex: `^${prefix.toLowerCase().trim()}`, $options: 'i' } }).sort({ 'usageCount.total': -1 }).limit(limit).lean();
};

export const Tag = (mongoose.models.Tag as ITagModel) || mongoose.model<ITagDocument, ITagModel>('Tag', TagSchema);

// 2. QuickReply Model
export interface IQuickReplyVariable {
  name?: string;
  fallback?: string;
}

export interface IQuickReply {
  workspace: Types.ObjectId;
  name: string;
  shortcut?: string;
  content: string;
  mediaUrl?: string;
  mediaType?: string;
  variables: IQuickReplyVariable[];
  isActive: boolean;
  createdBy?: Types.ObjectId;
  owner?: Types.ObjectId;
  scope: 'workspace' | 'personal';
  createdAt: Date;
  updatedAt: Date;
}

export interface IQuickReplyDocument extends IQuickReply, Document {}

const QuickReplySchema = new Schema<IQuickReplyDocument>({
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
  owner: { type: Schema.Types.ObjectId, ref: 'User' }, // For personal replies
  scope: { type: String, enum: ['workspace', 'personal'], default: 'workspace' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

QuickReplySchema.index({ workspace: 1, scope: 1, owner: 1 });
QuickReplySchema.index({ workspace: 1, name: 1, scope: 1, owner: 1 }, { unique: true });
QuickReplySchema.index({ workspace: 1, shortcut: 1 });

QuickReplySchema.pre<IQuickReplyDocument>('save', function() {
  this.updatedAt = new Date();
});

export const QuickReply = (mongoose.models.QuickReply as Model<IQuickReplyDocument>) || mongoose.model<IQuickReplyDocument>('QuickReply', QuickReplySchema);

// 3. ContactEvent Model
export interface IContactEvent {
  workspace: Types.ObjectId;
  contact: Types.ObjectId;
  type: string;
  description?: string;
  metadata?: any;
  createdBy?: Types.ObjectId;
  createdAt: Date;
}

export interface IContactEventDocument extends IContactEvent, Document {}

const ContactEventSchema = new Schema<IContactEventDocument>({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
  contact: { type: Schema.Types.ObjectId, ref: 'Contact', required: true },
  type: { type: String, required: true },
  description: { type: String },
  metadata: { type: Schema.Types.Mixed, default: {} },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

ContactEventSchema.index({ workspace: 1, contact: 1, createdAt: -1 });

export const ContactEvent = (mongoose.models.ContactEvent as Model<IContactEventDocument>) || mongoose.model<IContactEventDocument>('ContactEvent', ContactEventSchema);

// 4. ConversationLedger Model
export type ConversationCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION' | 'SERVICE';
export type ConversationInitiator = 'BUSINESS' | 'USER';
export type ConversationSource = 'CAMPAIGN' | 'INBOX' | 'API' | 'AUTOMATION' | 'ANSWERBOT';

export interface IConversationLedger {
  workspace: Types.ObjectId;
  conversation: Types.ObjectId;
  contact: Types.ObjectId;
  phoneNumber: string;
  category: ConversationCategory;
  initiatedBy: ConversationInitiator;
  source: ConversationSource;
  startedAt: Date;
  expiresAt: Date;
  isActive: boolean;
  closedAt?: Date;
  billable: boolean;
  billed: boolean;
  invoiceId?: string;
  billingPeriod?: string;
  template?: Types.ObjectId;
  templateName?: string;
  templateCategory?: string;
  firstMessageId?: Types.ObjectId;
  messageCount: number;
  businessMessageCount: number;
  userMessageCount: number;
  lastMessageAt?: Date;
  campaign?: Types.ObjectId;
  campaignName?: string;
  initiatedByUser?: Types.ObjectId;
  whatsappMessageId?: string;
  metaConversationId?: string;
  metaPricingType?: string;
  metaBillingData?: any;
  createdAt: Date;
  updatedAt: Date;
  notes?: string;
}

export interface IConversationLedgerDocument extends IConversationLedger, Document {
  isWindowActive(): boolean;
  recordMessage(direction: 'inbound' | 'outbound'): Promise<IConversationLedgerDocument>;
  closeWindow(): Promise<IConversationLedgerDocument>;
}

export interface IConversationLedgerModel extends Model<IConversationLedgerDocument> {
  findActiveWindow(workspaceId: string | Types.ObjectId, contactId: string | Types.ObjectId): Promise<IConversationLedgerDocument | null>;
  getBillingSummary(workspaceId: string | Types.ObjectId, startDate: Date | string, endDate: Date | string): Promise<any>;
  getMonthlyUsage(workspaceId: string | Types.ObjectId, year: number | string, month: number | string): Promise<any>;
}

const ConversationLedgerSchema = new Schema<IConversationLedgerDocument, IConversationLedgerModel>({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
  contact: { type: Schema.Types.ObjectId, ref: 'Contact', required: true },
  phoneNumber: { type: String, required: true, index: true },
  category: { type: String, enum: ['MARKETING', 'UTILITY', 'AUTHENTICATION', 'SERVICE'], required: true, index: true },
  initiatedBy: { type: String, enum: ['BUSINESS', 'USER'], required: true, index: true },
  source: { type: String, enum: ['CAMPAIGN', 'INBOX', 'API', 'AUTOMATION', 'ANSWERBOT'], required: true, index: true },
  startedAt: { type: Date, required: true, index: true },
  expiresAt: { type: Date, required: true, index: true },
  isActive: { type: Boolean, default: true, index: true },
  closedAt: { type: Date },
  billable: { type: Boolean, default: true, index: true },
  billed: { type: Boolean, default: false },
  invoiceId: { type: String },
  billingPeriod: { type: String, index: true },
  template: { type: Schema.Types.ObjectId, ref: 'Template' },
  templateName: { type: String },
  templateCategory: { type: String },
  firstMessageId: { type: Schema.Types.ObjectId, ref: 'Message' },
  messageCount: { type: Number, default: 1 },
  businessMessageCount: { type: Number, default: 0 },
  userMessageCount: { type: Number, default: 0 },
  lastMessageAt: { type: Date },
  campaign: { type: Schema.Types.ObjectId, ref: 'Campaign' },
  campaignName: { type: String },
  initiatedByUser: { type: Schema.Types.ObjectId, ref: 'User' },
  whatsappMessageId: { type: String },
  metaConversationId: { type: String },
  metaPricingType: { type: String },
  metaBillingData: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  notes: { type: String }
}, { timestamps: true });

ConversationLedgerSchema.index({ workspace: 1, contact: 1, category: 1, isActive: 1, expiresAt: 1 });
ConversationLedgerSchema.index({ workspace: 1, billingPeriod: 1, category: 1, billable: 1 });
ConversationLedgerSchema.index({ workspace: 1, startedAt: 1, category: 1 });
ConversationLedgerSchema.index({ workspace: 1, campaign: 1, billable: 1 });
ConversationLedgerSchema.index({ workspace: 1, source: 1, startedAt: 1 });

ConversationLedgerSchema.statics.findActiveWindow = async function(workspaceId, contactId) {
  return this.findOne({
    workspace: workspaceId,
    contact: contactId,
    isActive: true,
    expiresAt: { $gt: new Date() }
  }).sort({ startedAt: -1 });
};

ConversationLedgerSchema.statics.getBillingSummary = async function(workspaceId, startDate, endDate) {
  return this.aggregate([
    { $match: { workspace: new mongoose.Types.ObjectId(workspaceId as string), startedAt: { $gte: new Date(startDate), $lte: new Date(endDate) }, billable: true } },
    { $group: { _id: '$category', count: { $sum: 1 }, totalMessages: { $sum: '$messageCount' } } },
    { $project: { category: '$_id', count: 1, totalMessages: 1, _id: 0 } }
  ]);
};

ConversationLedgerSchema.statics.getMonthlyUsage = async function(workspaceId, year, month) {
  const billingPeriod = `${year}-${String(month).padStart(2, '0')}`;
  return this.aggregate([
    { $match: { workspace: new mongoose.Types.ObjectId(workspaceId as string), billingPeriod, billable: true } },
    { $group: { _id: { category: '$category', initiatedBy: '$initiatedBy' }, count: { $sum: 1 } } },
    { $group: { _id: null, total: { $sum: '$count' }, breakdown: { $push: { category: '$_id.category', initiatedBy: '$_id.initiatedBy', count: '$count' } } } }
  ]);
};

ConversationLedgerSchema.methods.isWindowActive = function(this: IConversationLedgerDocument) {
  return this.isActive && this.expiresAt > new Date();
};

ConversationLedgerSchema.methods.recordMessage = function(this: IConversationLedgerDocument, direction: 'inbound' | 'outbound') {
  this.messageCount += 1;
  this.lastMessageAt = new Date();
  if (direction === 'outbound') this.businessMessageCount += 1;
  else this.userMessageCount += 1;
  return this.save();
};

ConversationLedgerSchema.methods.closeWindow = function(this: IConversationLedgerDocument) {
  this.isActive = false;
  this.closedAt = new Date();
  return this.save();
};

ConversationLedgerSchema.pre<IConversationLedgerDocument>('save', function() {
  if (this.startedAt && !this.expiresAt) {
    this.expiresAt = new Date(this.startedAt.getTime() + 24 * 60 * 60 * 1000);
  }
  if (this.startedAt && !this.billingPeriod) {
    const date = new Date(this.startedAt);
    this.billingPeriod = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }
  if (this.expiresAt && new Date() > this.expiresAt) {
    this.isActive = false;
    if (!this.closedAt) this.closedAt = this.expiresAt;
  }
  this.updatedAt = new Date();
});

export const ConversationLedger = (mongoose.models.ConversationLedger as IConversationLedgerModel) || mongoose.model<IConversationLedgerDocument, IConversationLedgerModel>('ConversationLedger', ConversationLedgerSchema);

// --- Simple Referenced Schemas for Native Mongoose Population ---

const ContactSchema = new Schema({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
  name: String,
  phone: String,
  email: String,
  profilePicture: String,
  avatar: String,
  tags: [String]
});
export const Contact = mongoose.models.Contact || mongoose.model('Contact', ContactSchema);

const UserSchema = new Schema({
  name: String,
  email: String,
  role: String
});
export const User = mongoose.models.User || mongoose.model('User', UserSchema);

const TeamSchema = new Schema({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  name: { type: String, required: true },
  description: String,
  members: [{
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['lead', 'member'], default: 'member' },
    addedAt: { type: Date, default: Date.now }
  }],
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

TeamSchema.index({ workspace: 1, name: 1 }, { unique: true });
TeamSchema.index({ workspace: 1, 'members.user': 1 });

// @ts-ignore
TeamSchema.statics.findByUser = function(workspaceId: any, userId: any) {
  return this.find({
    workspace: new mongoose.Types.ObjectId(workspaceId),
    'members.user': new mongoose.Types.ObjectId(userId),
    isActive: true
  });
};

export const Team = mongoose.models.Team || mongoose.model('Team', TeamSchema);

const PermissionSchema = new Schema({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  role: { type: String, required: true },
  permissions: { type: Schema.Types.Mixed, default: {} },
  maxConcurrentChats: { type: Number, default: 10 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

PermissionSchema.index({ workspace: 1, user: 1 }, { unique: true });

export const Permission = mongoose.models.Permission || mongoose.model('Permission', PermissionSchema);

const PipelineSchema = new Schema({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
  name: { type: String, required: true },
  description: String,
  stages: [
    {
      id: { type: String, required: true },
      title: { type: String, required: true },
      position: { type: Number, required: true },
      isFinal: { type: Boolean, default: false },
      color: { type: String, default: '#6B7280' }
    }
  ],
  isDefault: { type: Boolean, default: false }
}, { timestamps: true });

PipelineSchema.index({ workspace: 1, name: 1 }, { unique: true });

export const Pipeline = mongoose.models.Pipeline || mongoose.model('Pipeline', PipelineSchema);

// Restored Deal Schema for CRM integration in Checkout Bot
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



