import mongoose, { Schema } from 'mongoose';

// User Schema
export const UserSchema = new Schema({
  name: String,
  email: { type: String, required: false },
  passwordHash: String,
  googleId: String,
  phone: String,
  phoneVerified: { type: Boolean, default: false },
  emailVerified: { type: Boolean, default: false },
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace' },
  activeWorkspace: { type: Schema.Types.ObjectId, ref: 'Workspace' },
  role: String,
  team: { type: Schema.Types.ObjectId, ref: 'Team' },
  authProvider: { type: String, default: 'local' },
  status: { type: String, default: 'active' },
  accountStatus: {
    type: String,
    enum: ['AWAITING_EMAIL_VERIFICATION', 'AWAITING_MOBILE_VERIFICATION', 'AWAITING_BUSINESS_INFO', 'SIGNUP_COMPLETED'],
    default: 'AWAITING_EMAIL_VERIFICATION'
  },
  lastLoginAt: { type: Date },
  profilePicture: { type: String },
  timezone: { type: String },
}, { timestamps: true });

export const getUserModel = (conn: typeof mongoose = mongoose) => 
  conn.models.User || conn.model('User', UserSchema);

// Workspace Schema
export const WorkspaceSchema = new Schema({
  name: { type: String, required: true },
  owner: { type: Schema.Types.ObjectId, ref: 'User' },
  plan: { type: Schema.Types.ObjectId, ref: 'Plan' },
  stage1: Schema.Types.Mixed,
  business: Schema.Types.Mixed,
  onboardingStatus: String,
  industry: String,
  website: String,
  address: String,
  city: String,
  state: String,
  country: String,
  zipCode: String,
  businessDocuments: Schema.Types.Mixed,
  businessVerification: Schema.Types.Mixed,
  wallet: Schema.Types.Mixed,
  limits: Schema.Types.Mixed,
}, { timestamps: true });

export const getWorkspaceModel = (conn: typeof mongoose = mongoose) => 
  conn.models.Workspace || conn.model('Workspace', WorkspaceSchema);

// Permission Schema
export const PermissionSchema = new Schema({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, required: true },
  permissions: { type: Schema.Types.Mixed },
  isActive: { type: Boolean, default: true },
  isOnline: { type: Boolean, default: false },
  isAvailable: { type: Boolean, default: true },
  lastSeenAt: { type: Date },
  maxConcurrentChats: { type: Number, default: 10 },
}, { timestamps: true });

export const getPermissionModel = (conn: typeof mongoose = mongoose) => 
  conn.models.Permission || conn.model('Permission', PermissionSchema);

// Contact Schema
export const ContactSchema = new Schema({
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
}, { timestamps: true });

export const getContactModel = (conn: typeof mongoose = mongoose) => 
  conn.models.Contact || conn.model('Contact', ContactSchema);

// Message Schema
export const MessageSchema = new Schema({
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

export const getMessageModel = (conn: typeof mongoose = mongoose) => 
  conn.models.Message || conn.model('Message', MessageSchema);

// Conversation Schema
export const ConversationSchema = new Schema({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
  contact: { type: Schema.Types.ObjectId, ref: 'Contact', required: true },
  channel: { type: String, default: 'whatsapp' },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
  team: { type: Schema.Types.ObjectId, ref: 'Team' },
  assignedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  assignedAt: { type: Date },
  lastRepliedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  lastAgentReplyAt: { type: Date },
  status: { type: String, enum: ['open', 'pending', 'resolved', 'closed', 'snoozed', 'spam'], default: 'open' },
  statusChangedAt: { type: Date, default: Date.now },
  statusChangedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  snoozedUntil: { type: Date },
  priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
  unreadCount: { type: Number, default: 0 },
  agentUnreadCounts: { type: Map, of: Number, default: new Map() },
  lastMessageAt: { type: Date },
  lastMessagePreview: { type: String },
  lastMessageDirection: { type: String, enum: ['inbound', 'outbound'] },
  lastMessageType: { type: String },
  firstResponseAt: { type: Date },
  firstResponseBy: { type: Schema.Types.ObjectId, ref: 'User' },
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

export const getConversationModel = (conn: typeof mongoose = mongoose) => 
  conn.models.Conversation || conn.model('Conversation', ConversationSchema);
