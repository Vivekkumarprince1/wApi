import mongoose, { Document, Schema, Model, Types } from 'mongoose';

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
  contact: Types.ObjectId;
  
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getAgentInbox(workspaceId: string | Types.ObjectId, agentId: string | Types.ObjectId, options?: any): Promise<IConversationDocument[]>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getAllInbox(workspaceId: string | Types.ObjectId, options?: any): Promise<IConversationDocument[]>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

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
  this.unreadCount = 0; // Reset global unread count as well
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
