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

// Kept for internalController esbFlow sync from bsp-service
export interface IEsbFlow {
  status: 'not_started' | 'signup_initiated' | 'code_received' | 'token_exchanged' |
    'business_verified' | 'phone_registered' | 'otp_sent' | 'otp_verified' |
    'system_user_created' | 'waba_activated' | 'completed' | 'failed' | 'phone_pending' | 'disconnected';
  accountBlocked: boolean;
  capabilityBlocked: boolean;
  accountBlockedReason?: string;
  capabilityBlockedReason?: string;
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


export interface IWorkspaceWallet {
  balance: number;
  parkedBalance: number;
  currency: string;
  lastRechargeAt?: Date;
  lowBalanceAlertAt?: Date;
  thresholdAmount: number;
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
  esbFlow: IEsbFlow;
  
  // BSP cache — kept in sync by bsp-service via POST /api/internal/bsp/sync-app-cache
  bspManaged: boolean;
  whatsappConnected: boolean;
  gupshupAppId?: string;
  bspWabaId?: string;
  bspPhoneNumberId?: string;
  phoneNumberId?: string;
  bspPhoneStatus: string;
  bspLastSyncedAt?: Date;

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

  esbFlow: {
    status: {
      type: String,
      enum: ['not_started', 'signup_initiated', 'code_received', 'token_exchanged',
        'business_verified', 'phone_registered', 'otp_sent', 'otp_verified',
        'system_user_created', 'waba_activated', 'completed', 'failed', 'phone_pending', 'disconnected'],
      default: 'not_started'
    },
    accountBlocked: { type: Boolean, default: false },
    capabilityBlocked: { type: Boolean, default: false },
    accountBlockedReason: { type: String },
    capabilityBlockedReason: { type: String },
    lastTokenRefreshAttempt: { type: Date },
    lastTokenRefreshError: { type: String }
  },

  // BSP cache — kept in sync by bsp-service via POST /api/internal/bsp/sync-app-cache
  bspManaged: { type: Boolean, default: true },
  whatsappConnected: { type: Boolean, default: false },
  gupshupAppId: { type: String },
  bspWabaId: { type: String },
  bspPhoneNumberId: { type: String, sparse: true },
  phoneNumberId: { type: String },
  bspPhoneStatus: { type: String, default: 'PENDING' },
  bspLastSyncedAt: { type: Date },
  
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
WorkspaceSchema.index({ phoneNumberId: 1 }, { unique: true, sparse: true });
WorkspaceSchema.index({ bspManaged: 1, bspPhoneStatus: 1 });

WorkspaceSchema.pre<IWorkspaceDocument>('save', function () {
  this.updatedAt = new Date();
});

WorkspaceSchema.methods.ensureWorkspaceBspReady = function (): boolean {
  if (!this.bspManaged) {
    throw Object.assign(new Error('Workspace is not configured for WhatsApp.'), { code: 'WORKSPACE_NOT_BSP_MANAGED' });
  }
  return true;
};

WorkspaceSchema.methods.getMessagingCapabilityState = function () {
  const esbFlow = this.esbFlow || {};

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
