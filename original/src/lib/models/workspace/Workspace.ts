import mongoose, { Document, Schema, Model, Types } from 'mongoose';

// ═══════════════════════════════════════════════════════════════════
// SUB-SCHEMAS & INTERFACES
// ═══════════════════════════════════════════════════════════════════

export interface IBusinessDocuments {
  gstNumber?: string;
  msmeNumber?: string;
  panNumber?: string;
  certificationNumber?: string;
  documentType?: 'gst' | 'msme' | 'pan' | 'other';
  documentUrl?: string;
  submittedAt?: Date;
}

export interface IBusinessVerification {
  status: 'not_submitted' | 'pending' | 'in_review' | 'verified' | 'rejected';
  submittedAt?: Date;
  verifiedAt?: Date;
  verifiedBy?: string;
  rejectedAt?: Date;
  rejectionReason?: string;
  metaVerificationId?: string;
  lastCheckedAt?: Date;
  adminNotes?: string;
  isTestMode: boolean;
}

export interface IEsbFlow {
  status: 'not_started' | 'signup_initiated' | 'code_received' | 'token_exchanged' |
    'business_verified' | 'phone_registered' | 'otp_sent' | 'otp_verified' |
    'system_user_created' | 'waba_activated' | 'completed' | 'failed' | 'phone_pending' | 'disconnected';
  authState?: string;
  authCode?: string;
  authCodeExpiresAt?: Date;
  userAccessToken?: string;
  userRefreshToken?: string;
  tokenExpiry?: Date;
  systemUserId?: string;
  systemUserToken?: string;
  systemUserTokenExpiry?: Date;
  phoneNumberIdForOTP?: string;
  phoneOTPCode?: string;
  phoneOTPExpiry?: Date;
  phoneOTPAttempts: number;
  phoneOTPVerifiedAt?: Date;
  callbackState?: string;
  callbackReceived: boolean;
  callbackReceivedAt?: Date;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  callbackData?: any;
  contactSyncFingerprint?: string;
  contactSyncedAt?: Date;
  subscriptionSyncedAt?: Date;
  embedUrl?: string;
  startedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  failureReason?: string;
  createdBy?: string;
  notes?: string;
  metaAccountStatus?: string;
  metaAccountStatusUpdatedAt?: Date;
  accountBlocked: boolean;
  accountBlockedReason?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metaCapabilities?: any;
  capabilityBlocked: boolean;
  capabilityBlockedReason?: string;
  metaDecisionStatus?: string;
  lastTokenRefreshAttempt?: Date;
  lastTokenRefreshError?: string;
}

export interface IWebhookSubscription {
  url: string;
  events: string[];
  secret?: string;
  isActive: boolean;
  createdAt: Date;
}

export interface IWorkspaceOnboarding {
  step?: string;
  status?: 'not-started' | 'in-progress' | 'completed';
  businessInfoCompleted?: boolean;
  businessInfoCompletedAt?: Date;
  businessVerificationCompleted?: boolean;
  businessVerificationCompletedAt?: Date;
  businessConfirmationCompleted?: boolean;
  businessConfirmationCompletedAt?: Date;
  wabaConnectionInitiated?: boolean;
  wabaConnectionInitiatedAt?: Date;
  wabaConnectionCompleted?: boolean;
  wabaConnectionCompletedAt?: Date;
  whatsappSetupCompleted?: boolean;
  templateSetupCompleted?: boolean;
  completed?: boolean;
  completedAt?: Date;
  accountVerifiedAt?: Date;
}

export interface IGupshupIdentity {
  partnerAppId?: string;
  appApiKey?: string;
  appApiKeyExpiresAt?: Date;
  appApiKeyRefreshedAt?: Date;
  appStatus?: 'pending' | 'created' | 'active' | 'suspended';
  source?: string;
}

export interface IWorkspaceWallet {
  balance: number;
  parkedBalance: number;
  currency: string;
  lastRechargeAt?: Date;
  lowBalanceAlertAt?: Date;
  thresholdAmount: number;
}

export interface IBspAudit {
  phoneAssignedAt?: Date;
  phoneAssignedBy?: string;
  lastStatusCheck?: Date;
  lastQualityUpdate?: Date;
  warnings?: Array<{
    type?: string;
    message?: string;
    createdAt?: Date;
  }>;
}

export interface IContactCustomFieldDefinition {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'date';
}

export interface IContactTagOption {
  label?: string;
  color?: string;
}

export interface IContactLeadStatus {
  key: string;
  label: string;
  color?: string;
}

// ═══════════════════════════════════════════════════════════════════
// MAIN WORKSPACE INTERFACE
// ═══════════════════════════════════════════════════════════════════

export interface IWorkspace {
  name: string;
  owner: Types.ObjectId;
  plan?: Types.ObjectId;
  planId?: string; // Slug representation
  billingCycle: 'monthly' | 'yearly';
  activePhoneNumberId?: string;
  billingStatus: 'trialing' | 'active' | 'past_due' | 'suspended' | 'canceled';
  suspensionReason?: string;
  
  industry?: string;
  companySize?: string;
  annualRevenue?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  description?: string;

  businessDocuments?: IBusinessDocuments;
  businessVerification: IBusinessVerification;
  onboarding?: IWorkspaceOnboarding;
  esbFlow: IEsbFlow;
  
  // Backwards compatibility / BSP
  bspManaged: boolean;
  businessId?: string;
  wabaId?: string;
  childWabaId?: string;
  metaBusinessId?: string;
  businessAccountId?: string;
  whatsappConnected: boolean;
  whatsappAccessToken?: string;
  whatsappVerifyToken?: string;
  connectedAt?: Date;
  wabaStatus?: string;
  verifiedName?: string;
  qualityRating?: string;
  messagingLimitTier?: string;
  codeVerificationStatus?: string;
  nameStatus?: string;
  isOfficialAccount: boolean;
  accessToken?: string;
  tokenExpiresAt?: Date;
  gupshupIdentity?: IGupshupIdentity;
  bspWabaId?: string;
  gupshupAppId?: string;
  gupshupAppName?: string;
  onboardingStatus?: string;
  gupshupAppLive?: boolean;
  gupshupAppHealth?: boolean | null;
  gupshupWalletBalance?: number;
  gupshupRatings?: any;
  bspLastSyncedAt?: Date;
  bspSyncStatus?: string;
  bspPhoneNumberId: string;
  bspDisplayPhoneNumber?: string;
  bspVerifiedName?: string;
  whatsappPhoneNumberId?: string;
  whatsappPhoneNumber?: string;
  phoneNumberId?: string;
  bspPhoneStatus: string;
  bspQualityRating: string;
  bspMessagingTier: string;
  bspOnboardedAt?: Date;
  bspAudit?: IBspAudit;
  businessProfile?: Record<string, unknown>;
  phoneNumbers?: Array<{
    id?: string;
    displayPhoneNumber?: string;
    verifiedName?: string;
    qualityRating?: string;
    status?: string;
  }>;

  // Developer Portal
  apiKeys: Array<{
    key: string;
    name: string;
    templateName?: string | null;
    isActive: boolean;
    createdAt: Date;
    lastUsedAt?: Date;
  }>;

  // External Webhooks (Developer Portal)
  webhookSubscriptions: IWebhookSubscription[];

  // Wallet & Billing
  wallet: IWorkspaceWallet;
  walletBalance: number;
  walletParkedBalance: number;
  walletCurrency: string;
  walletThreshold: number;

  // Optimized Billing & Autopay
  autoPay: boolean;
  billingPivotDate?: Date;
  taxId?: string;

  // Plan & Usage
  planLimits: {
    maxContacts: number;
    maxMessages: number;
    maxTemplates: number;
    maxCampaigns: number;
    maxAutomations: number;
    maxActiveDeals: number;
    maxPipelines: number;
  };
  usage: {
    contacts: number;
    messages: number;
    messagesDaily: number;
    messagesThisMonth: number;
    messagesSentToday: number;
    templates: number;
    campaigns: number;
    automations: number;
    products: number;
    deals: number;
  };

  // Inbox & SLA
  inboxSettings: {
    autoAssignmentEnabled: boolean;
    assignmentStrategy: 'ROUND_ROBIN' | 'LEAST_ASSIGNED' | 'LEAST_UNREAD' | 'MANUAL';
    lastAssignedAgentIndex: number;
    slaEnabled: boolean;
    slaFirstResponseMinutes: number;
    slaResolutionMinutes: number;
    agentRateLimitEnabled: boolean;
    agentMessagesPerMinute: number;
    softLockEnabled: boolean;
    softLockTimeoutSeconds: number;
  };

  // Automation
  automationSettings: {
    aiIntentMatchEnabled: boolean;
    aiMatchConfidenceThreshold: number;
    aiMonthlyLimit: number;
  };

  // Contacts Settings (Merged)
  contactSettings: {
    customFieldDefinitions: IContactCustomFieldDefinition[];
    tagsOptions: IContactTagOption[];
    leadStatuses: IContactLeadStatus[];
  };

  createdAt: Date;
  updatedAt: Date;
  
  // Method typings
  ensureWorkspaceBspReady(): boolean;
  getMessagingCapabilityState(): { blocked: boolean; stale: boolean; reason: string | null };
}

export interface IWorkspaceDocument extends IWorkspace, Document {}

// ═══════════════════════════════════════════════════════════════════
// MONGOOSE SCHEMA
// ═══════════════════════════════════════════════════════════════════

const WorkspaceSchema = new Schema<IWorkspaceDocument>({
  name: { type: String, required: true },
  owner: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  plan: { type: Schema.Types.ObjectId, ref: 'Plan', index: true },
  planId: { type: String },
  billingCycle: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
  activePhoneNumberId: { type: String },
  billingStatus: { type: String, enum: ['trialing', 'active', 'past_due', 'suspended', 'canceled'], default: 'trialing' },
  suspensionReason: { type: String },
  
  industry: { type: String },
  companySize: { type: String },
  annualRevenue: { type: String },
  website: { type: String },
  address: { type: String },
  city: { type: String },
  state: { type: String },
  country: { type: String },
  zipCode: { type: String },
  description: { type: String },

  businessDocuments: {
    gstNumber: { type: String },
    msmeNumber: { type: String },
    panNumber: { type: String },
    certificationNumber: { type: String },
    documentType: { type: String, enum: ['gst', 'msme', 'pan', 'other'] },
    documentUrl: { type: String },
    submittedAt: { type: Date }
  },

  businessVerification: {
    status: {
      type: String,
      enum: ['not_submitted', 'pending', 'in_review', 'verified', 'rejected'],
      default: 'not_submitted'
    },
    submittedAt: { type: Date },
    verifiedAt: { type: Date },
    verifiedBy: { type: String },
    rejectedAt: { type: Date },
    rejectionReason: { type: String },
    metaVerificationId: { type: String },
    lastCheckedAt: { type: Date },
    adminNotes: { type: String },
    isTestMode: { type: Boolean, default: false }
  },

  onboarding: {
    step: { type: String, default: 'business-info' },
    status: { type: String, enum: ['not-started', 'in-progress', 'completed'], default: 'not-started' },
    businessInfoCompleted: { type: Boolean, default: false },
    businessInfoCompletedAt: { type: Date },
    businessVerificationCompleted: { type: Boolean, default: false },
    businessVerificationCompletedAt: { type: Date },
    businessConfirmationCompleted: { type: Boolean, default: false },
    businessConfirmationCompletedAt: { type: Date },
    wabaConnectionInitiated: { type: Boolean, default: false },
    wabaConnectionInitiatedAt: { type: Date },
    wabaConnectionCompleted: { type: Boolean, default: false },
    wabaConnectionCompletedAt: { type: Date },
    whatsappSetupCompleted: { type: Boolean, default: false },
    templateSetupCompleted: { type: Boolean, default: false },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date },
    accountVerifiedAt: { type: Date }
  },

  esbFlow: {
    status: {
      type: String,
      enum: ['not_started', 'signup_initiated', 'code_received', 'token_exchanged',
        'business_verified', 'phone_registered', 'otp_sent', 'otp_verified',
        'system_user_created', 'waba_activated', 'completed', 'failed', 'phone_pending', 'disconnected'],
      default: 'not_started'
    },
    authState: { type: String },
    authCode: { type: String },
    authCodeExpiresAt: { type: Date },
    userAccessToken: { type: String },
    userRefreshToken: { type: String },
    tokenExpiry: { type: Date },
    systemUserId: { type: String },
    systemUserToken: { type: String },
    systemUserTokenExpiry: { type: Date },
    phoneNumberIdForOTP: { type: String },
    phoneOTPCode: { type: String },
    phoneOTPExpiry: { type: Date },
    phoneOTPAttempts: { type: Number, default: 0 },
    phoneOTPVerifiedAt: { type: Date },
    callbackState: { type: String },
    callbackReceived: { type: Boolean, default: false },
    callbackReceivedAt: { type: Date },
    callbackData: { type: Schema.Types.Mixed },
    contactSyncFingerprint: { type: String },
    contactSyncedAt: { type: Date },
    subscriptionSyncedAt: { type: Date },
    embedUrl: { type: String },
    startedAt: { type: Date },
    completedAt: { type: Date },
    failedAt: { type: Date },
    failureReason: { type: String },
    createdBy: { type: String },
    notes: { type: String },
    metaAccountStatus: { type: String },
    metaAccountStatusUpdatedAt: { type: Date },
    accountBlocked: { type: Boolean, default: false },
    accountBlockedReason: { type: String },
    metaCapabilities: { type: Schema.Types.Mixed },
    capabilityBlocked: { type: Boolean, default: false },
    capabilityBlockedReason: { type: String },
    metaDecisionStatus: { type: String },
    lastTokenRefreshAttempt: { type: Date },
    lastTokenRefreshError: { type: String }
  },

  bspManaged: { type: Boolean, default: true },
  businessId: { type: String },
  wabaId: { type: String },
  childWabaId: { type: String },
  metaBusinessId: { type: String },
  businessAccountId: { type: String },
  whatsappConnected: { type: Boolean, default: false },
  whatsappAccessToken: { type: String },
  whatsappVerifyToken: { type: String },
  connectedAt: { type: Date },
  wabaStatus: { type: String },
  verifiedName: { type: String },
  qualityRating: { type: String, default: 'UNKNOWN' },
  messagingLimitTier: { type: String },
  codeVerificationStatus: { type: String },
  nameStatus: { type: String },
  isOfficialAccount: { type: Boolean, default: false },
  accessToken: { type: String },
  tokenExpiresAt: { type: Date },
  gupshupIdentity: {
    partnerAppId: { type: String },
    appApiKey: { type: String },
    appApiKeyExpiresAt: { type: Date },
    appApiKeyRefreshedAt: { type: Date },
    appStatus: { type: String, enum: ['pending', 'created', 'active', 'suspended'] },
    source: { type: String }
  },
  bspWabaId: { type: String },
  gupshupAppId: { type: String },
  gupshupAppName: { type: String },
  onboardingStatus: { type: String },
  gupshupAppLive: { type: Boolean, default: false },
  gupshupAppHealth: { type: Boolean },
  gupshupWalletBalance: { type: Number },
  gupshupRatings: { type: Schema.Types.Mixed },
  bspLastSyncedAt: { type: Date },
  bspSyncStatus: { type: String, default: 'INACTIVE' },
  bspPhoneNumberId: { type: String, unique: true, sparse: true },
  bspDisplayPhoneNumber: { type: String },
  bspVerifiedName: { type: String },
  whatsappPhoneNumberId: { type: String },
  whatsappPhoneNumber: { type: String },
  phoneNumberId: { type: String },
  bspPhoneStatus: { type: String, default: 'PENDING' },
  bspQualityRating: { type: String, default: 'UNKNOWN' },
  bspMessagingTier: { type: String, default: 'TIER_1K' },
  bspOnboardedAt: { type: Date },
  bspAudit: {
    phoneAssignedAt: { type: Date },
    phoneAssignedBy: { type: String },
    lastStatusCheck: { type: Date },
    lastQualityUpdate: { type: Date },
    warnings: [{
      type: { type: String },
      message: { type: String },
      createdAt: { type: Date, default: Date.now }
    }]
  },
  businessProfile: { type: Schema.Types.Mixed },
  phoneNumbers: [{
    id: { type: String },
    displayPhoneNumber: { type: String },
    verifiedName: { type: String },
    qualityRating: { type: String },
    status: { type: String }
  }],
  
  // Developer Portal
  apiKeys: [{
    key: { type: String, required: true, index: true },
    name: { type: String, default: 'Default Key' },
    templateName: { type: String },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    lastUsedAt: { type: Date }
  }],

  // External Webhooks
  webhookSubscriptions: [{
    url: { type: String, required: true },
    events: [{ type: String }],
    secret: { type: String },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
  }],

  // Wallet (Nested structure matching production DB)
  wallet: {
    balance: { type: Number, default: 0 },
    parkedBalance: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
    lastRechargeAt: { type: Date },
    lowBalanceAlertAt: { type: Date },
    thresholdAmount: { type: Number, default: 500 }
  },

  // Wallet (Legacy root-level fields - keep for secondary compatibility)
  walletBalance: { type: Number, default: 0 },
  walletParkedBalance: { type: Number, default: 0 },
  walletCurrency: { type: String, default: 'INR' },
  walletThreshold: { type: Number, default: 500 },

  // Optimized Billing & Autopay
  autoPay: { type: Boolean, default: true },
  billingPivotDate: { type: Date },
  taxId: { type: String },

  // Plan & Usage
  planLimits: {
    maxContacts: { type: Number, default: 0 },
    maxMessages: { type: Number, default: 0 },
    maxTemplates: { type: Number, default: 0 },
    maxCampaigns: { type: Number, default: 0 },
    maxAutomations: { type: Number, default: 0 },
    maxActiveDeals: { type: Number, default: 0 },
    maxPipelines: { type: Number, default: 0 }
  },
  usage: {
    contacts: { type: Number, default: 0 },
    messages: { type: Number, default: 0 },
    messagesDaily: { type: Number, default: 0 },
    messagesThisMonth: { type: Number, default: 0 },
    messagesSentToday: { type: Number, default: 0 },
    templates: { type: Number, default: 0 },
    campaigns: { type: Number, default: 0 },
    automations: { type: Number, default: 0 },
    products: { type: Number, default: 0 },
    deals: { type: Number, default: 0 }
  },

  // Inbox & SLA
  inboxSettings: {
    autoAssignmentEnabled: { type: Boolean, default: false },
    assignmentStrategy: { 
      type: String, 
      enum: ['ROUND_ROBIN', 'LEAST_ASSIGNED', 'LEAST_UNREAD', 'MANUAL'],
      default: 'MANUAL'
    },
    lastAssignedAgentIndex: { type: Number, default: 0 },
    slaEnabled: { type: Boolean, default: false },
    slaFirstResponseMinutes: { type: Number, default: 60 },
    slaResolutionMinutes: { type: Number, default: 1440 },
    agentRateLimitEnabled: { type: Boolean, default: true },
    agentMessagesPerMinute: { type: Number, default: 30 },
    softLockEnabled: { type: Boolean, default: true },
    softLockTimeoutSeconds: { type: Number, default: 60 }
  },

  // Automation
  automationSettings: {
    aiIntentMatchEnabled: { type: Boolean, default: false },
    aiMatchConfidenceThreshold: { type: Number, default: 0.7 },
    aiMonthlyLimit: { type: Number, default: 5000 }
  },

  // Contacts Settings (Merged)
  contactSettings: {
    customFieldDefinitions: [{
      key: { type: String, required: true },
      label: { type: String, required: true },
      type: { type: String, enum: ['string', 'number', 'boolean', 'date'], default: 'string' }
    }],
    tagsOptions: [{
      label: { type: String },
      color: { type: String }
    }],
    leadStatuses: {
      type: [{
        key: { type: String, required: true },
        label: { type: String, required: true },
        color: { type: String }
      }],
      default: [
        { key: 'new', label: 'New', color: '#10B981' },
        { key: 'open', label: 'Open', color: '#3B82F6' },
        { key: 'qualified', label: 'Qualified', color: '#F59E0B' },
        { key: 'unqualified', label: 'Unqualified', color: '#EF4444' }
      ]
    }
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Indexes
WorkspaceSchema.index({ createdAt: 1 });
WorkspaceSchema.index({ owner: 1, updatedAt: -1 });
WorkspaceSchema.index({ gupshupAppId: 1 }, { sparse: true });
WorkspaceSchema.index({ whatsappPhoneNumberId: 1 }, { unique: true, sparse: true });
WorkspaceSchema.index({ phoneNumberId: 1 }, { unique: true, sparse: true });
WorkspaceSchema.index({ 'gupshupIdentity.partnerAppId': 1 }, { unique: true, sparse: true });
WorkspaceSchema.index({ bspManaged: 1, bspPhoneStatus: 1 });

WorkspaceSchema.pre<IWorkspaceDocument>('save', function () {
  this.updatedAt = new Date();
  
  if (this.bspManaged) {
    if (this.bspPhoneNumberId && !this.whatsappPhoneNumberId) {
      this.whatsappPhoneNumberId = this.bspPhoneNumberId;
    }
    if (this.bspDisplayPhoneNumber && !this.whatsappPhoneNumber) {
      this.whatsappPhoneNumber = this.bspDisplayPhoneNumber;
    }
  }

});

WorkspaceSchema.methods.ensureWorkspaceBspReady = function (): boolean {
  if (!this.bspManaged) {
    throw Object.assign(new Error('Workspace is not configured for WhatsApp.'), { code: 'WORKSPACE_NOT_BSP_MANAGED' });
  }
  return true;
};

WorkspaceSchema.methods.getMessagingCapabilityState = function () {
  const esbFlow = this.esbFlow || {};
  const phoneStatus = String(this.bspPhoneStatus || '').toUpperCase();
  const phoneOperational = phoneStatus === 'CONNECTED' || this.whatsappConnected === true;

  if (esbFlow.accountBlocked) {
    return { blocked: true, stale: false, reason: esbFlow.accountBlockedReason || 'Account is blocked' };
  }

  if (this.bspPhoneStatus === 'BANNED' || this.bspPhoneStatus === 'DISCONNECTED') {
    return { blocked: true, stale: false, reason: `Phone status is ${this.bspPhoneStatus}` };
  }

  return { blocked: false, stale: false, reason: null };
};

// Ensure single compilation
export const Workspace: Model<IWorkspaceDocument> = mongoose.models.Workspace || mongoose.model<IWorkspaceDocument>('Workspace', WorkspaceSchema);
