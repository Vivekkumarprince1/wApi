import mongoose, { Schema } from 'mongoose';

// User Schema
const UserSchema = new Schema({
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

export const User = mongoose.models.User || mongoose.model('User', UserSchema);

// Plan Schema
const PlanSchema = new Schema({
  name: { type: String, required: true },
  code: { type: String, required: true },
  slug: String,
  features: [String],
  limits: Schema.Types.Mixed,
});

export const Plan = mongoose.models.Plan || mongoose.model('Plan', PlanSchema);

// Workspace Schema
const WorkspaceSchema = new Schema({
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
  planLimits: Schema.Types.Mixed,
  inboxSettings: Schema.Types.Mixed,
}, { timestamps: true });

export const Workspace = mongoose.models.Workspace || mongoose.model('Workspace', WorkspaceSchema);

// Permission Schema
const PermissionSchema = new Schema({
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

PermissionSchema.statics.getDefaultPermissions = function(role: string) {
  const defaults: any = {
    owner: {
      viewAllConversations: true, assignConversations: true, resolveConversations: true,
      sendMessages: true, sendTemplates: true, sendCampaigns: true, scheduleMessages: true,
      viewContacts: true, createContacts: true, editContacts: true, deleteContacts: true, importContacts: true, exportContacts: true,
      viewTemplates: true, createTemplates: true, editTemplates: true, deleteTemplates: true, submitTemplates: true,
      viewCampaigns: true, createCampaigns: true, editCampaigns: true, launchCampaigns: true, pauseCampaigns: true,
      viewDeals: true, createDeals: true, editDeals: true, deleteDeals: true,
      manageTeam: true, manageBilling: true, manageIntegrations: true, manageWebhooks: true, viewAuditLogs: true,
      billing: { view: true, manage: true },
      viewAnalytics: true, viewReports: true, exportData: true
    },
    admin: {
      viewAllConversations: true, assignConversations: true, resolveConversations: true,
      sendMessages: true, sendTemplates: true, sendCampaigns: true, scheduleMessages: true,
      viewContacts: true, createContacts: true, editContacts: true, deleteContacts: true, importContacts: true, exportContacts: true,
      viewTemplates: true, createTemplates: true, editTemplates: true, deleteTemplates: true, submitTemplates: true,
      viewCampaigns: true, createCampaigns: true, editCampaigns: true, launchCampaigns: true, pauseCampaigns: true,
      viewDeals: true, createDeals: true, editDeals: true, deleteDeals: true,
      manageTeam: true, manageBilling: true, manageIntegrations: true, manageWebhooks: true, viewAuditLogs: true,
      billing: { view: true, manage: true },
      viewAnalytics: true, viewReports: true, exportData: true
    },
    manager: {
      viewAllConversations: true, assignConversations: true, resolveConversations: true,
      sendMessages: true, sendTemplates: true, sendCampaigns: true, scheduleMessages: true,
      viewContacts: true, createContacts: true, editContacts: true, deleteContacts: false, importContacts: true, exportContacts: true,
      viewTemplates: true, createTemplates: true, editTemplates: true, deleteTemplates: false, submitTemplates: true,
      viewCampaigns: true, createCampaigns: true, editCampaigns: true, launchCampaigns: true, pauseCampaigns: true,
      viewDeals: true, createDeals: true, editDeals: true, deleteDeals: false,
      manageTeam: false, manageBilling: false, manageIntegrations: false, manageWebhooks: false, viewAuditLogs: true,
      billing: { view: true, manage: false },
      viewAnalytics: true, viewReports: true, exportData: true
    },
    agent: {
      viewAllConversations: false, assignConversations: false, resolveConversations: true,
      sendMessages: true, sendTemplates: true, sendCampaigns: false, scheduleMessages: false,
      viewContacts: true, createContacts: true, editContacts: true, deleteContacts: false, importContacts: false, exportContacts: false,
      viewTemplates: true, createTemplates: false, editTemplates: false, deleteTemplates: false, submitTemplates: false,
      viewCampaigns: true, createCampaigns: false, editCampaigns: false, launchCampaigns: false, pauseCampaigns: false,
      viewDeals: true, createDeals: true, editDeals: true, deleteDeals: false,
      manageTeam: false, manageBilling: false, manageIntegrations: false, manageWebhooks: false, viewAuditLogs: false,
      billing: { view: false, manage: false },
      viewAnalytics: false, viewReports: false, exportData: false
    },
    viewer: {
      viewAllConversations: false, assignConversations: false, resolveConversations: false,
      sendMessages: false, sendTemplates: false, sendCampaigns: false, scheduleMessages: false,
      viewContacts: true, createContacts: false, editContacts: false, deleteContacts: false, importContacts: false, exportContacts: false,
      viewTemplates: true, createTemplates: false, editTemplates: false, deleteTemplates: false, submitTemplates: false,
      viewCampaigns: true, createCampaigns: false, editCampaigns: false, launchCampaigns: false, pauseCampaigns: false,
      viewDeals: true, createDeals: false, editDeals: false, deleteDeals: false,
      manageTeam: false, manageBilling: false, manageIntegrations: false, manageWebhooks: false, viewAuditLogs: false,
      billing: { view: false, manage: false },
      viewAnalytics: true, viewReports: true, exportData: false
    }
  };
  return defaults[role] || defaults.viewer;
};

PermissionSchema.statics.seedOwnerPermissions = function(workspaceId: any, userId: any) {
  return this.create({
    workspace: workspaceId,
    user: userId,
    role: 'owner',
    permissions: (this as any).getDefaultPermissions('owner')
  });
};

export const Permission = (mongoose.models.Permission || mongoose.model('Permission', PermissionSchema)) as any;

// System Settings Schema
const SystemSettingsSchema = new Schema({
  maintenanceMode: { type: Boolean, default: false },
  maintenanceMessage: String,
  features: { type: Schema.Types.Mixed },
}, { strict: false, collection: 'system_settings' });

SystemSettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    const legacy = await this.db.collection('systemsettings').findOne({});
    settings = await this.create({
      maintenanceMode: legacy?.maintenanceMode ?? false,
      maintenanceMessage: legacy?.maintenanceMessage ?? '',
      systemNotice: legacy?.systemNotice ?? null,
      features: legacy?.features ?? {},
    });
  }
  return settings;
};

export const SystemSettings = (mongoose.models.SystemSettings || mongoose.model('SystemSettings', SystemSettingsSchema)) as any;

// Generic OTP Schema
const OtpSchema = new Schema({
  purpose: { type: String, required: true },
  identifier: { type: String, required: true, index: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  otpHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  consumedAt: { type: Date, default: null },
}, { timestamps: true });
OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Otp = mongoose.models.Otp || mongoose.model('Otp', OtpSchema);

// Business Schema
const BusinessSchema = new Schema({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, unique: true, index: true },
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, trim: true, lowercase: true },
  category: { type: String, trim: true },
  address: {
    line1: { type: String },
    city: { type: String },
    state: { type: String },
    country: { type: String, default: 'India' },
    postalCode: { type: String }
  },
  gstNumber: { type: String, uppercase: true, trim: true, sparse: true, index: true },
  msmeNumber: { type: String, uppercase: true, trim: true, sparse: true, index: true },
  panNumber: { type: String, uppercase: true, trim: true },
  legalName: { type: String },
  registryStatus: { type: String },
  verificationProvider: { type: String, enum: ['mock', 'cleartax', 'karza'], default: 'mock' },
  verificationStatus: {
    type: String,
    enum: ['not_submitted', 'pending', 'verified', 'rejected'],
    default: 'not_submitted',
    index: true
  },
  verificationPayload: { type: Schema.Types.Mixed },
  nameMatchScore: { type: Number },
  confirmed: { type: Boolean, default: false },
  confirmedAt: { type: Date },
  verifiedAt: { type: Date },
  razorpayKeyId: { type: String },
  commerceSettings: { type: Schema.Types.Mixed, default: {} }
}, { timestamps: true });

export const Business = mongoose.models.Business || mongoose.model('Business', BusinessSchema);

// Workspace Invitation Schema
const WorkspaceInvitationSchema = new Schema({
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  name: { type: String },
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  role: { type: String, required: true },
  permissionsOverride: { type: Schema.Types.Mixed },
  invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  token: { type: String, required: true, unique: true, index: true },
  status: { 
    type: String, 
    enum: ['pending', 'accepted', 'expired', 'revoked'], 
    default: 'pending' 
  },
  phone: { type: String, trim: true },
  teams: [{ type: Schema.Types.ObjectId, ref: 'Team' }],
  expiresAt: { type: Date, required: true },
  joinedAt: { type: Date },
  resendCount: { type: Number, default: 0 },
  lastSentAt: { type: Date, default: Date.now },
}, { timestamps: true });

WorkspaceInvitationSchema.index({ email: 1, workspace: 1, status: 1 }, { 
  unique: true, 
  partialFilterExpression: { status: 'pending' } 
});

export const WorkspaceInvitation = mongoose.models.WorkspaceInvitation || mongoose.model('WorkspaceInvitation', WorkspaceInvitationSchema);

// Team Schema
const TeamSchema = new Schema({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  name: { type: String, required: true, trim: true, maxLength: 100 },
  description: { type: String, trim: true, maxLength: 500 },
  members: [{
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['lead', 'member'], default: 'member' },
    addedAt: { type: Date, default: Date.now }
  }],
  visibility: { type: String, enum: ['team_only', 'all'], default: 'team_only' },
  autoAssign: {
    enabled: { type: Boolean, default: false },
    strategy: { type: String, enum: ['round_robin', 'least_busy', 'random'], default: 'round_robin' },
    lastAssignedIndex: { type: Number, default: 0 }
  },
  isActive: { type: Boolean, default: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

TeamSchema.index({ workspace: 1, name: 1 }, { unique: true });

export const Team = mongoose.models.Team || mongoose.model('Team', TeamSchema);

// Role Schema
const RoleSchema = new Schema({
  name: { type: String, required: true },
  slug: { type: String, index: true },
  description: { type: String },
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', index: true },
  permissions: { type: Schema.Types.Mixed, required: true },
  isSystem: { type: Boolean, default: false },
  color: { type: String, default: 'slate' }
}, { timestamps: true });

RoleSchema.index({ workspace: 1, name: 1 }, { unique: true, sparse: true });

export const Role = mongoose.models.Role || mongoose.model('Role', RoleSchema);

// Notification Schema
const NotificationSchema = new Schema({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: {
    type: String,
    // Invitation types this service emits + the monolith notification types
    // (chat-service writes 'assignment' docs into the same shared collection)
    enum: ['invitation_accepted', 'invitation_declined', 'system_alert', 'billing_alert',
           'info', 'success', 'warning', 'error', 'assignment', 'campaign', 'billing', 'system'],
    required: true
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  link: { type: String },
  read: { type: Boolean, default: false },
  metadata: { type: Schema.Types.Mixed },
}, { timestamps: true });

NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

export const Notification = mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);

// OtpChallenge Schema
const OtpChallengeSchema = new Schema({
  identifier: { type: String, required: true, index: true },
  channel: { type: String, enum: ['email', 'phone'], required: true },
  purpose: {
    type: String,
    enum: ['phone_login', 'email_login', 'email_verification', 'phone_verification', 'signup_email'],
    required: true,
    index: true
  },
  otpHash: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  attempts: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 5 },
  retryCount: { type: Number, default: 0 },
  lastSentAt: { type: Date, default: Date.now },
  consumedAt: { type: Date },
  metadata: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

OtpChallengeSchema.index({ identifier: 1, purpose: 1, consumedAt: 1 });

export const OtpChallenge = mongoose.models.OtpChallenge || mongoose.model('OtpChallenge', OtpChallengeSchema);

// SignupOtp Schema
const SignupOtpSchema = new Schema({
  email: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  passwordHash: { type: String, required: true },
  otpHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  consumedAt: { type: Date, default: null },
}, { timestamps: true });
SignupOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const SignupOtp = mongoose.models.SignupOtp || mongoose.model('SignupOtp', SignupOtpSchema);

// WebhookPolicy Schema
const WEBHOOK_SUBSCRIPTION_MODES = [
  'NONE',
  'TEMPLATE',
  'ACCOUNT',
  'PAYMENTS',
  'FLOWS_MESSAGE',
  'MESSAGE',
  'OTHERS',
  'ALL',
  'BILLING',
  'FAILED',
  'SENT',
  'DELIVERED',
  'READ',
  'ENQUEUED',
  'COEXISTENCE',
  'DELETED'
] as const;

const WebhookPolicySchema = new Schema({
  scope: {
    type: String,
    enum: ['global', 'workspace', 'app'],
    required: true
  },
  workspace: {
    type: Schema.Types.ObjectId,
    ref: 'Workspace',
    index: true
  },
  appId: {
    type: String,
    trim: true,
    index: true
  },
  webhookEnabled: {
    type: Boolean,
    default: true
  },
  webhookMode: {
    type: String,
    enum: ['sandbox', 'production'],
    default: 'production'
  },
  defaultModes: {
    type: [{ type: String, enum: WEBHOOK_SUBSCRIPTION_MODES }],
    default: undefined
  },
  allowedModes: {
    type: [{ type: String, enum: WEBHOOK_SUBSCRIPTION_MODES }],
    default: undefined
  },
  statusViewRoles: {
    type: [{ type: String }],
    default: undefined
  },
  notes: {
    type: String,
    trim: true
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

WebhookPolicySchema.index({ scope: 1 }, { unique: true, partialFilterExpression: { scope: 'global' } });
WebhookPolicySchema.index({ scope: 1, workspace: 1 }, { unique: true, partialFilterExpression: { scope: 'workspace' } });
WebhookPolicySchema.index(
  { scope: 1, workspace: 1, appId: 1 },
  { unique: true, partialFilterExpression: { scope: 'app' } }
);

export const WebhookPolicy = mongoose.models.WebhookPolicy || mongoose.model('WebhookPolicy', WebhookPolicySchema);

// AuditLog Schema
const AuditLogSchema = new Schema({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  user: { type: Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, required: true, index: true },
  resource: {
    type: { type: String },
    id: { type: Schema.Types.ObjectId },
    name: { type: String }
  },
  details: { type: Schema.Types.Mixed },
  ip: { type: String },
  userAgent: { type: String }
}, { timestamps: true });

AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
AuditLogSchema.index({ workspace: 1, action: 1, createdAt: -1 });

AuditLogSchema.statics.logAdminAction = async function(data: any) {
  const { workspaceId, userId, action, resource, details, req } = data;
  
  let ip = 'unknown';
  let userAgent = 'unknown';
  let finalWorkspaceId = workspaceId;

  if (req) {
    ip = req.headers?.['x-forwarded-for'] || req.ip || 'unknown';
    userAgent = req.headers?.['user-agent'] || 'unknown';
    
    if (!finalWorkspaceId) {
      finalWorkspaceId = req.workspace?._id || req.user?.activeWorkspace || req.user?.workspace;
    }
  }

  if (!finalWorkspaceId && userId) {
    try {
      const User = mongoose.model('User');
      const user = await User.findById(userId).select('activeWorkspace workspace');
      finalWorkspaceId = user?.activeWorkspace || user?.workspace;
    } catch (err) {
      console.error("[AuditLog Hardening] Failed to resolve user workspace:", err);
    }
  }
  
  return this.create({
    workspace: finalWorkspaceId,
    user: userId,
    action,
    resource,
    details,
    ip,
    userAgent
  });
};

export const AuditLog = (mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema)) as any;

// BusinessAppMap Schema
const BusinessAppMapSchema = new Schema({
  business: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  app: { type: Schema.Types.ObjectId, ref: 'GupshupApp', required: true, index: true },
  gupshupAppId: { type: String, required: true, index: true },
  assignmentSource: { type: String, enum: ['workspace_existing', 'sandbox_reclaimed', 'fresh_created', 'mock_created'] },
  active: { type: Boolean, default: true, index: true },
  assignedAt: { type: Date, default: Date.now },
  disconnectedAt: { type: Date }
}, { timestamps: true });

BusinessAppMapSchema.index(
  { business: 1, active: 1 },
  { unique: true, partialFilterExpression: { active: true } }
);
BusinessAppMapSchema.index(
  { app: 1, active: 1 },
  { unique: true, partialFilterExpression: { active: true } }
);
BusinessAppMapSchema.index(
  { gupshupAppId: 1, active: 1 },
  { unique: true, partialFilterExpression: { active: true } }
);

export const BusinessAppMap = mongoose.models.BusinessAppMap || mongoose.model('BusinessAppMap', BusinessAppMapSchema);

// BspHealth Schema
const BspHealthSchema = new Schema({
  key: { type: String, required: true, unique: true },
  status: { type: String, enum: ['healthy', 'warning', 'critical'], default: 'warning' },
  isValid: { type: Boolean, default: false },
  expiresAt: { type: Date },
  checkedAt: { type: Date },
  lastHealthyAt: { type: Date },
  error: { type: String },
  meta: { type: Schema.Types.Mixed }
}, { timestamps: true });

export const BspHealth = mongoose.models.BspHealth || mongoose.model('BspHealth', BspHealthSchema);

// BusinessVerificationPolicy Schema
const BusinessVerificationPolicySchema = new Schema({
  key: { type: String, required: true, unique: true, index: true, default: 'global', trim: true },
  mandatory: { type: Boolean, default: false, index: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  notes: { type: String, trim: true }
}, { timestamps: true });

export const BusinessVerificationPolicy = mongoose.models.BusinessVerificationPolicy || mongoose.model('BusinessVerificationPolicy', BusinessVerificationPolicySchema);

// ActivityLog — workspace-scoped audit trail in the shared wapi DB (monolith
// parity). Same schema as chat/contact services'; the analytics dashboard reads it.
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
