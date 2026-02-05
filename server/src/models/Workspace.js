const mongoose = require('mongoose');

const WorkspaceSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  plan: { 
    type: String, 
    enum: ['free', 'basic', 'premium', 'enterprise'], 
    default: 'free' 
  },
  // BSP billing (single active phone + suspension mirror)
  activePhoneNumberId: { type: String },
  billingStatus: {
    type: String,
    enum: ['trialing', 'active', 'past_due', 'suspended', 'canceled'],
    default: 'trialing'
  },
  suspensionReason: { type: String },
  // Business Information
  industry: { type: String },
  companySize: { type: String },
  website: { type: String },
  address: { type: String },
  city: { type: String },
  state: { type: String },
  country: { type: String },
  zipCode: { type: String },
  description: { type: String },
  
  // Official Business Documents for Verification
  businessDocuments: {
    gstNumber: { type: String },
    msmeNumber: { type: String },
    panNumber: { type: String },
    documentType: { 
      type: String, 
      enum: ['gst', 'msme', 'pan', 'other'] 
    },
    documentUrl: { type: String }, // URL of uploaded document if any
    submittedAt: { type: Date }
  },
  
  // Business Verification Status
  businessVerification: {
    status: { 
      type: String, 
      enum: ['not_submitted', 'pending', 'in_review', 'verified', 'rejected'],
      default: 'not_submitted'
    },
    submittedAt: { type: Date },
    verifiedAt: { type: Date },
    verifiedBy: { type: String }, // Admin email who verified
    rejectedAt: { type: Date },
    rejectionReason: { type: String },
    metaVerificationId: { type: String },
    lastCheckedAt: { type: Date },
    adminNotes: { type: String }, // Internal notes from admin
    isTestMode: { type: Boolean, default: false } // Allow testing without verification
  },
  // Onboarding tracking
  onboarding: {
    step: { type: String, default: 'business-info' },
    status: { type: String, enum: ['not-started', 'in-progress', 'completed'], default: 'not-started' },
    businessInfoCompleted: { type: Boolean, default: false },
    businessInfoCompletedAt: { type: Date },
    wabaConnectionInitiated: { type: Boolean, default: false },
    wabaConnectionInitiatedAt: { type: Date },
    wabaConnectionCompleted: { type: Boolean, default: false },
    wabaConnectionCompletedAt: { type: Date },
    whatsappSetupCompleted: { type: Boolean, default: false },
    templateSetupCompleted: { type: Boolean, default: false },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date }
  },
  // Embedded Signup Business (ESB) Flow - Automated Meta Onboarding
  esbFlow: {
    // ESB Flow Status
    status: {
      type: String,
      enum: ['not_started', 'signup_initiated', 'code_received', 'token_exchanged', 
             'business_verified', 'phone_registered', 'otp_sent', 'otp_verified', 
             'system_user_created', 'waba_activated', 'completed', 'failed'],
      default: 'not_started'
    },
    // Authorization & State
    authState: { type: String }, // State param for CSRF protection
    authCode: { type: String }, // Authorization code from Meta
    authCodeExpiresAt: { type: Date },
    // User Tokens
    userAccessToken: { type: String }, // Long-lived user token for API calls
    userRefreshToken: { type: String }, // Refresh token if provided
    tokenExpiry: { type: Date },
    // System User & Tokens
    systemUserId: { type: String }, // Meta system user ID
    systemUserToken: { type: String }, // System user token for server-to-server calls
    systemUserTokenExpiry: { type: Date },
    // Phone Registration
    phoneNumberIdForOTP: { type: String }, // Phone number ID before OTP verification
    phoneOTPCode: { type: String }, // OTP code for verification
    phoneOTPExpiry: { type: Date },
    phoneOTPAttempts: { type: Number, default: 0 },
    phoneOTPVerifiedAt: { type: Date },
    // Callback Handling
    callbackState: { type: String }, // State for callback verification
    callbackReceived: { type: Boolean, default: false },
    callbackReceivedAt: { type: Date },
    callbackData: { type: mongoose.Schema.Types.Mixed }, // Raw callback data from Meta
    // Timestamps
    startedAt: { type: Date },
    completedAt: { type: Date },
    failedAt: { type: Date },
    failureReason: { type: String },
    // Admin tracking
    createdBy: { type: String }, // User email who initiated
    notes: { type: String },
    // ✅ Account status tracking
    metaAccountStatus: { type: String }, // ACTIVE, DISABLED, PENDING_REVIEW
    metaAccountStatusUpdatedAt: { type: Date },
    accountBlocked: { type: Boolean, default: false },
    accountBlockedReason: { type: String },
    // ✅ Capability tracking
    metaCapabilities: { type: mongoose.Schema.Types.Mixed }, // Track capabilities per type
    capabilityBlocked: { type: Boolean, default: false },
    capabilityBlockedReason: { type: String },
    metaDecisionStatus: { type: String },
    // ✅ Token refresh tracking
    lastTokenRefreshAttempt: { type: Date },
    lastTokenRefreshError: { type: String }
  },

  // WhatsApp setup request with OTP verification (kept for backwards compatibility)
  whatsappSetup: {
    requestedNumber: { type: String },
    hasExistingAccount: { type: Boolean },
    requestedAt: { type: Date },
    status: { 
      type: String, 
      enum: ['not_started', 'otp_sent', 'otp_expired', 'otp_verified', 'registering', 'pending_activation', 'connected', 'failed', 'blocked'],
      default: 'not_started'
    },
    // OTP verification
    otp: { type: String },
    otpExpiry: { type: Date },
    otpAttempts: { type: Number, default: 0 },
    verifiedAt: { type: Date },
    // Registration
    registrationStartedAt: { type: Date },
    registrationCompletedAt: { type: Date },
    // Admin management
    notes: { type: String },
    completedBy: { type: String },
    completedAt: { type: Date },
    failureReason: { type: String }
  },
  // Backwards-compatible top-level WABA fields (some controllers expect these)
  // NOTE: In BSP-parented mode these are internal-only references and MUST NOT
  // be configurable per-tenant via public APIs.
  whatsappAccessToken: { type: String },
  /**
   * Legacy phone_number_id field.
   *
   * For BSP-parented SaaS we MUST guarantee that a given WhatsApp
   * phone_number_id is never reused across workspaces. Global uniqueness is
   * enforced via a sparse unique index further below.
   */
  whatsappPhoneNumberId: { type: String },
  whatsappPhoneNumber: { type: String }, // Actual phone number like +919876543210
  wabaId: { type: String },
  childWabaId: { type: String }, // Child WABA ID under Parent WABA (ESB v3)
  businessId: { type: String }, // Meta Business ID
  metaBusinessId: { type: String }, // Explicit alias for Meta business ID (audit-safe)
  businessAccountId: { type: String },
  whatsappVerifyToken: { type: String },
  connectedAt: { type: Date },
  whatsappConnected: { type: Boolean, default: false }, // Quick check if WhatsApp is connected
  
  // Phone metadata (BSP model - synced from Meta)
  /**
   * Internal mirror of phone_number_id used by some legacy services.
   * This MUST stay globally unique just like bspPhoneNumberId and
   * whatsappPhoneNumberId to prevent phone number reuse across tenants.
   */
  phoneNumberId: { type: String }, // Same as whatsappPhoneNumberId, for clarity
  verifiedName: { type: String }, // Display name verified by Meta
  qualityRating: { type: String, enum: ['GREEN', 'YELLOW', 'RED', 'UNKNOWN'], default: 'UNKNOWN' },
  messagingLimitTier: { type: String }, // TIER_1K, TIER_10K, etc.
  codeVerificationStatus: { type: String }, // VERIFIED, NOT_VERIFIED
  nameStatus: { type: String }, // APPROVED, PENDING, REJECTED
  isOfficialAccount: { type: Boolean, default: false },
  
  // Token storage (BSP model)
  accessToken: { type: String }, // User's access token (encrypt in production)
  tokenExpiresAt: { type: Date },
  
  // ═══════════════════════════════════════════════════════════════════
  // BSP MULTI-TENANT CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════
  
  /**
   * BSP Managed flag - TRUE for all tenants under your parent WABA
   * When true, all Meta API calls use the centralized BSP system token
   * Per-workspace tokens are ignored when this is true
   */
  bspManaged: { type: Boolean, default: true },

  /**
   * Parent WABA reference (singleton authority)
   * Interakt-style: platform owns ONE Parent WABA
   */
  parentWaba: { type: mongoose.Schema.Types.ObjectId, ref: 'ParentWABA' },

  /**
   * ChildBusiness reference (per-tenant phone asset)
   */
  childBusiness: { type: mongoose.Schema.Types.ObjectId, ref: 'ChildBusiness' },
  
  /**
   * Parent WABA ID - Reference to your BSP's WABA
   * All tenants share this WABA but have different phone_number_ids
   */
  bspWabaId: { type: String },
  
  /**
   * The phone_number_id assigned to this tenant/workspace
   * This is the PRIMARY KEY for multi-tenant routing
   * Each workspace MUST have a unique phone_number_id
   */
  bspPhoneNumberId: { type: String, unique: true, sparse: true },
  
  /**
   * Display phone number for this workspace (e.g., +919876543210)
   */
  bspDisplayPhoneNumber: { type: String },
  
  /**
   * Verified business name for this phone number (from Meta)
   */
  bspVerifiedName: { type: String },
  
  /**
   * Phone number status from Meta
   */
  bspPhoneStatus: { 
    type: String, 
    enum: ['PENDING', 'CONNECTED', 'DISCONNECTED', 'BANNED', 'FLAGGED', 'RATE_LIMITED'],
    default: 'PENDING'
  },
  
  /**
   * Quality rating from Meta for this phone number
   */
  bspQualityRating: { 
    type: String, 
    enum: ['GREEN', 'YELLOW', 'RED', 'UNKNOWN'],
    default: 'UNKNOWN'
  },
  
  /**
   * Messaging limit tier from Meta (TIER_1K, TIER_10K, TIER_100K, TIER_UNLIMITED)
   */
  bspMessagingTier: { type: String, default: 'TIER_1K' },
  
  /**
   * When this workspace was onboarded to BSP
   */
  bspOnboardedAt: { type: Date },
  
  /**
   * BSP-specific rate limiting overrides (optional)
   * If set, overrides plan-based limits
   */
  bspRateLimits: {
    messagesPerSecond: { type: Number },
    dailyMessageLimit: { type: Number },
    monthlyMessageLimit: { type: Number },
    templateSubmissionsPerDay: { type: Number }
  },
  
  /**
   * BSP usage tracking (separate from general usage)
   */
  bspUsage: {
    messagesThisSecond: { type: Number, default: 0 },
    lastMessageTimestamp: { type: Date },
    messagesToday: { type: Number, default: 0 },
    messagesThisMonth: { type: Number, default: 0 },
    templateSubmissionsToday: { type: Number, default: 0 },
    lastUsageReset: { type: Date, default: Date.now },
    lastMonthlyReset: { type: Date, default: Date.now }
  },
  
  /**
   * Audit trail for BSP actions
   */
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
  
  // Business profile from Meta
  businessProfile: {
    about: { type: String },
    address: { type: String },
    description: { type: String },
    email: { type: String },
    profilePictureUrl: { type: String },
    websites: [{ type: String }],
    vertical: { type: String }
  },
  
  // All phone numbers for this WABA (for multi-phone support)
  phoneNumbers: [{
    id: { type: String },
    displayPhoneNumber: { type: String },
    verifiedName: { type: String },
    qualityRating: { type: String }
  }],
  
  planLimits: {
    maxContacts: { type: Number, default: 100 },
    maxMessages: { type: Number, default: 1000 },
    maxTemplates: { type: Number, default: 10 },
    maxCampaigns: { type: Number, default: 5 },
    maxAutomations: { type: Number, default: 3 }
  },
  usage: {
    contacts: { type: Number, default: 0 },
    messages: { type: Number, default: 0 },
    messagesDaily: { type: Number, default: 0 },
    messagesThisMonth: { type: Number, default: 0 },
    templates: { type: Number, default: 0 },
    campaigns: { type: Number, default: 0 },
    automations: { type: Number, default: 0 },
    products: { type: Number, default: 0 },
    lastResetDate: { type: Date, default: Date.now },
    lastMonthlyResetDate: { type: Date, default: Date.now }
  },
  whatsappConfig: {
    phoneNumberId: { type: String },
    businessAccountId: { type: String },
    accessToken: { type: String },
    webhookVerifyToken: { type: String },
    isConnected: { type: Boolean, default: false }
  },
  instagramConfig: {
    accountId: { type: String },
    accessToken: { type: String },
    isConnected: { type: Boolean, default: false }
  },
  settings: {
    timezone: { type: String, default: 'UTC' },
    language: { type: String, default: 'en' },
    notifications: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      push: { type: Boolean, default: true }
    }
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // STAGE 4 HARDENING: INBOX SETTINGS
  // ═══════════════════════════════════════════════════════════════════
  inboxSettings: {
    // Auto-assignment configuration
    autoAssignmentEnabled: { type: Boolean, default: false },
    assignmentStrategy: {
      type: String,
      enum: ['ROUND_ROBIN', 'LEAST_ASSIGNED', 'LEAST_UNREAD', 'MANUAL'],
      default: 'MANUAL'
    },
    // Track last assigned agent for round-robin
    lastAssignedAgentIndex: { type: Number, default: 0 },
    
    // SLA configuration
    slaEnabled: { type: Boolean, default: false },
    slaFirstResponseMinutes: { type: Number, default: 60 }, // Default 1 hour
    slaResolutionMinutes: { type: Number, default: 1440 }, // Default 24 hours
    slaBreachAutoEscalate: { type: Boolean, default: true },
    
    // Agent rate limiting (safety)
    agentRateLimitEnabled: { type: Boolean, default: true },
    agentMessagesPerMinute: { type: Number, default: 30 },
    
    // Soft lock settings
    softLockEnabled: { type: Boolean, default: true },
    softLockTimeoutSeconds: { type: Number, default: 60 }
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // STAGE 5: BILLING QUOTA & USAGE TRACKING
  // ═══════════════════════════════════════════════════════════════════
  
  /**
   * Billing quota limits per month
   * Based on plan tier
   */
  billingQuota: {
    // Total monthly conversation limit
    monthlyConversations: { type: Number, default: 1000 },
    
    // Per-category limits (optional - for enterprise plans)
    marketingConversations: { type: Number },
    utilityConversations: { type: Number },
    authenticationConversations: { type: Number },
    serviceConversations: { type: Number },
    
    // Warning and block thresholds (percentage)
    warningThreshold: { type: Number, default: 80 },
    blockThreshold: { type: Number, default: 100 },
    
    // Whether to hard block or just warn
    hardBlock: { type: Boolean, default: false },
    
    // Custom override (for enterprise deals)
    isCustom: { type: Boolean, default: false },
    customQuotaNote: { type: String }
  },
  
  /**
   * Monthly usage counters (reset at start of billing period)
   */
  billingUsage: {
    // Total conversations this month
    monthlyConversationsUsed: { type: Number, default: 0 },
    
    // Breakdown by category
    marketingUsed: { type: Number, default: 0 },
    utilityUsed: { type: Number, default: 0 },
    authenticationUsed: { type: Number, default: 0 },
    serviceUsed: { type: Number, default: 0 },
    
    // Breakdown by initiator
    businessInitiated: { type: Number, default: 0 },
    userInitiated: { type: Number, default: 0 },
    
    // Breakdown by source
    campaignConversations: { type: Number, default: 0 },
    inboxConversations: { type: Number, default: 0 },
    apiConversations: { type: Number, default: 0 },
    automationConversations: { type: Number, default: 0 },
    
    // Total messages (not conversations)
    totalMessagesSent: { type: Number, default: 0 },
    totalMessagesReceived: { type: Number, default: 0 },
    templateMessagesSent: { type: Number, default: 0 },
    
    // Reset tracking
    lastResetAt: { type: Date, default: Date.now },
    billingPeriodStart: { type: Date },
    billingPeriodEnd: { type: Date },
    
    // Warning status
    warningIssuedAt: { type: Date },
    warningAcknowledgedAt: { type: Date },
    blockIssuedAt: { type: Date }
  },
  
  subscription: {
    status: { 
      type: String, 
      enum: ['active', 'inactive', 'cancelled', 'past_due'], 
      default: 'active' 
    },
    startDate: { type: Date },
    endDate: { type: Date },
    autoRenew: { type: Boolean, default: true },
    razorpaySubscriptionId: { type: String },
    razorpayCustomerId: { type: String }
  },
  billingInfo: {
    email: { type: String },
    phone: { type: String },
    address: {
      line1: { type: String },
      line2: { type: String },
      city: { type: String },
      state: { type: String },
      country: { type: String },
      postalCode: { type: String }
    }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

WorkspaceSchema.index({ createdAt: 1 });

// ═══════════════════════════════════════════════════════════════════
// BSP MULTI-TENANT INDEXES & INVARIANTS
// ═══════════════════════════════════════════════════════════════════

// Index for finding all workspaces under a BSP WABA
WorkspaceSchema.index({ bspWabaId: 1, bspManaged: 1 });

// Globally unique phone_number_id invariants (no reuse across tenants)
WorkspaceSchema.index(
  { whatsappPhoneNumberId: 1 },
  { unique: true, sparse: true, name: 'uniq_whatsapp_phone_number_id' }
);
WorkspaceSchema.index(
  { phoneNumberId: 1 },
  { unique: true, sparse: true, name: 'uniq_workspace_phone_number_id' }
);
// bspPhoneNumberId already has a unique constraint at field level, which
// together with the indexes above guarantees that a Meta phone number is
// never bound to more than one workspace at a time.

// Indexes for quality/status monitoring
WorkspaceSchema.index({ bspManaged: 1, bspPhoneStatus: 1 });
WorkspaceSchema.index({ bspManaged: 1, bspQualityRating: 1 });

// Update the updatedAt timestamp on save
WorkspaceSchema.pre('save', function(next) {
  this.updatedAt = new Date();

  // ═══════════════════════════════════════════════════════════════════
  // BSP FIELD SYNCHRONIZATION
  // ═══════════════════════════════════════════════════════════════════
  
  // If BSP managed, sync bspPhoneNumberId with legacy whatsappPhoneNumberId
  if (this.bspManaged) {
    if (this.bspPhoneNumberId && !this.whatsappPhoneNumberId) {
      this.whatsappPhoneNumberId = this.bspPhoneNumberId;
    }
    if (this.bspDisplayPhoneNumber && !this.whatsappPhoneNumber) {
      this.whatsappPhoneNumber = this.bspDisplayPhoneNumber;
    }
    // Clear any per-workspace tokens when BSP managed (security)
    // All API calls should use the centralized BSP token
    if (this.whatsappAccessToken && this.isModified('bspManaged')) {
      console.log(`[BSP] Clearing per-workspace token for workspace ${this._id} - now BSP managed`);
      this.whatsappAccessToken = null;
    }
  }

  // Sync top-level WABA fields with nested `whatsappConfig` for backwards compatibility
  try {
    if (!this.whatsappConfig) this.whatsappConfig = {};

    // If top-level values exist, ensure whatsappConfig mirrors them
    if (this.whatsappAccessToken) this.whatsappConfig.accessToken = this.whatsappAccessToken;
    if (this.whatsappPhoneNumberId) this.whatsappConfig.phoneNumberId = this.whatsappPhoneNumberId;
    if (this.businessAccountId) this.whatsappConfig.businessAccountId = this.businessAccountId;
    if (this.whatsappVerifyToken) this.whatsappConfig.webhookVerifyToken = this.whatsappVerifyToken;
    if (this.connectedAt && !this.whatsappConfig.isConnected) this.whatsappConfig.isConnected = true;

    // If nested config exists but top-level is empty, populate top-level for older controllers
    if (!this.whatsappAccessToken && this.whatsappConfig.accessToken) this.whatsappAccessToken = this.whatsappConfig.accessToken;
    if (!this.whatsappPhoneNumberId && this.whatsappConfig.phoneNumberId) this.whatsappPhoneNumberId = this.whatsappConfig.phoneNumberId;
    if (!this.businessAccountId && this.whatsappConfig.businessAccountId) this.businessAccountId = this.whatsappConfig.businessAccountId;
    if (!this.whatsappVerifyToken && this.whatsappConfig.webhookVerifyToken) this.whatsappVerifyToken = this.whatsappConfig.webhookVerifyToken;
  } catch (err) {
    // don't block save on sync errors
    console.error('Workspace pre-save sync error:', err.message);
  }

  next();
});

// Method to check if workspace has reached limit
WorkspaceSchema.methods.hasReachedLimit = function(resource) {
  return this.usage[resource] >= this.planLimits[`max${resource.charAt(0).toUpperCase() + resource.slice(1)}`];
};

// Method to increment usage
WorkspaceSchema.methods.incrementUsage = function(resource, amount = 1) {
  this.usage[resource] = (this.usage[resource] || 0) + amount;
  return this.save();
};

// Method to decrement usage
WorkspaceSchema.methods.decrementUsage = function(resource, amount = 1) {
  this.usage[resource] = Math.max(0, (this.usage[resource] || 0) - amount);
  return this.save();
};

// ═══════════════════════════════════════════════════════════════════
// STAGE 5: BILLING USAGE METHODS
// ═══════════════════════════════════════════════════════════════════

/**
 * Increment conversation billing counters atomically
 * Called when a new billable conversation starts
 * 
 * @param {String} category - MARKETING, UTILITY, AUTHENTICATION, SERVICE
 * @param {String} initiatedBy - BUSINESS, USER
 * @param {String} source - CAMPAIGN, INBOX, API, AUTOMATION
 */
WorkspaceSchema.methods.incrementBillingUsage = async function(category, initiatedBy, source) {
  const categoryField = `billingUsage.${category.toLowerCase()}Used`;
  const initiatorField = initiatedBy === 'BUSINESS' ? 
    'billingUsage.businessInitiated' : 'billingUsage.userInitiated';
  
  const sourceFieldMap = {
    'CAMPAIGN': 'billingUsage.campaignConversations',
    'INBOX': 'billingUsage.inboxConversations',
    'API': 'billingUsage.apiConversations',
    'AUTOMATION': 'billingUsage.automationConversations',
    'ANSWERBOT': 'billingUsage.automationConversations'
  };
  const sourceField = sourceFieldMap[source] || 'billingUsage.inboxConversations';
  
  const updateOps = {
    $inc: {
      'billingUsage.monthlyConversationsUsed': 1,
      [categoryField]: 1,
      [initiatorField]: 1,
      [sourceField]: 1
    }
  };
  
  return await this.constructor.findByIdAndUpdate(this._id, updateOps, { new: true });
};

/**
 * Check if workspace is at or over quota
 * @returns {Object} { isWarning, isBlocked, percentage, remaining }
 */
WorkspaceSchema.methods.checkBillingQuota = function() {
  const quota = this.billingQuota || {};
  const usage = this.billingUsage || {};
  
  const limit = quota.monthlyConversations || 1000;
  const used = usage.monthlyConversationsUsed || 0;
  const percentage = (used / limit) * 100;
  
  const warningThreshold = quota.warningThreshold || 80;
  const blockThreshold = quota.blockThreshold || 100;
  const hardBlock = quota.hardBlock !== false; // Default true
  
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    percentage: Math.round(percentage * 100) / 100,
    isWarning: percentage >= warningThreshold,
    isBlocked: percentage >= blockThreshold && hardBlock,
    isSoftWarning: percentage >= blockThreshold && !hardBlock,
    warningThreshold,
    blockThreshold
  };
};

/**
 * Reset monthly billing counters
 * Called at the start of a new billing period
 */
WorkspaceSchema.methods.resetBillingUsage = async function() {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  
  return await this.constructor.findByIdAndUpdate(
    this._id,
    {
      $set: {
        'billingUsage.monthlyConversationsUsed': 0,
        'billingUsage.marketingUsed': 0,
        'billingUsage.utilityUsed': 0,
        'billingUsage.authenticationUsed': 0,
        'billingUsage.serviceUsed': 0,
        'billingUsage.businessInitiated': 0,
        'billingUsage.userInitiated': 0,
        'billingUsage.campaignConversations': 0,
        'billingUsage.inboxConversations': 0,
        'billingUsage.apiConversations': 0,
        'billingUsage.automationConversations': 0,
        'billingUsage.totalMessagesSent': 0,
        'billingUsage.totalMessagesReceived': 0,
        'billingUsage.templateMessagesSent': 0,
        'billingUsage.lastResetAt': now,
        'billingUsage.billingPeriodStart': now,
        'billingUsage.billingPeriodEnd': nextMonth,
        'billingUsage.warningIssuedAt': null,
        'billingUsage.warningAcknowledgedAt': null,
        'billingUsage.blockIssuedAt': null
      }
    },
    { new: true }
  );
};

/**
 * Increment message counters (not conversations)
 * @param {String} direction - inbound or outbound
 * @param {Boolean} isTemplate - whether it's a template message
 */
WorkspaceSchema.methods.incrementMessageUsage = async function(direction, isTemplate = false) {
  const updateOps = {
    $inc: {}
  };
  
  if (direction === 'outbound') {
    updateOps.$inc['billingUsage.totalMessagesSent'] = 1;
    if (isTemplate) {
      updateOps.$inc['billingUsage.templateMessagesSent'] = 1;
    }
  } else {
    updateOps.$inc['billingUsage.totalMessagesReceived'] = 1;
  }
  
  return await this.constructor.findByIdAndUpdate(this._id, updateOps, { new: true });
};

// ═══════════════════════════════════════════════════════════════════
// BSP HELPER METHODS
// ═══════════════════════════════════════════════════════════════════

/**
 * Check if workspace is BSP managed and connected
 */
WorkspaceSchema.methods.isBspConnected = function() {
  return this.bspManaged && 
         this.bspPhoneNumberId && 
         this.bspPhoneStatus === 'CONNECTED';
};

/**
 * Get the phone_number_id for this workspace
 * BSP managed workspaces use bspPhoneNumberId, others use legacy field
 */
WorkspaceSchema.methods.getPhoneNumberId = function() {
  if (this.bspManaged) {
    return this.bspPhoneNumberId;
  }
  return this.whatsappPhoneNumberId;
};

/**
 * Check if workspace can send messages (BSP rate limits)
 */
WorkspaceSchema.methods.canSendMessage = function() {
  if (!this.bspManaged) return true;

  // Meta enforcement checks (Interakt-grade safety)
  if (this.esbFlow?.accountBlocked || this.esbFlow?.capabilityBlocked) {
    return false;
  }

  // Quality rating protection (avoid suspension risk)
  const quality = this.bspQualityRating || this.qualityRating;
  if (quality === 'RED') {
    return false;
  }
  
  if (this.bspPhoneStatus === 'BANNED' || this.bspPhoneStatus === 'RATE_LIMITED') {
    return false;
  }
  
  return true;
};

/**
 * Increment BSP message usage atomically
 */
WorkspaceSchema.methods.incrementBspMessageUsage = async function() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  // Check if we need to reset daily counter
  const lastReset = this.bspUsage?.lastUsageReset || new Date(0);
  const shouldResetDaily = lastReset < today;
  
  // Check if we need to reset monthly counter
  const lastMonthlyReset = this.bspUsage?.lastMonthlyReset || new Date(0);
  const shouldResetMonthly = lastMonthlyReset < thisMonth;
  
  const updateOps = {
    $inc: { 
      'bspUsage.messagesToday': shouldResetDaily ? 1 : 1,
      'bspUsage.messagesThisMonth': shouldResetMonthly ? 1 : 1
    },
    $set: {
      'bspUsage.lastMessageTimestamp': now
    }
  };
  
  if (shouldResetDaily) {
    updateOps.$set['bspUsage.messagesToday'] = 1;
    updateOps.$set['bspUsage.lastUsageReset'] = today;
    delete updateOps.$inc['bspUsage.messagesToday'];
  }
  
  if (shouldResetMonthly) {
    updateOps.$set['bspUsage.messagesThisMonth'] = 1;
    updateOps.$set['bspUsage.lastMonthlyReset'] = thisMonth;
    delete updateOps.$inc['bspUsage.messagesThisMonth'];
  }
  
  return await this.constructor.findByIdAndUpdate(this._id, updateOps, { new: true });
};

/**
 * Static method to find workspace by phone_number_id (for webhook routing)
 */
WorkspaceSchema.statics.findByPhoneNumberId = async function(phoneNumberId) {
  // First try BSP phone number ID (new model)
  let workspace = await this.findOne({ bspPhoneNumberId: phoneNumberId });
  
  // Fallback to legacy field for backwards compatibility
  if (!workspace) {
    workspace = await this.findOne({ whatsappPhoneNumberId: phoneNumberId });
  }
  
  return workspace;
};

/**
 * Static method to get all BSP managed workspaces
 */
WorkspaceSchema.statics.findBspManagedWorkspaces = function(wabaId) {
  const query = { bspManaged: true };
  if (wabaId) {
    query.bspWabaId = wabaId;
  }
  return this.find(query);
};

module.exports = mongoose.model('Workspace', WorkspaceSchema);
