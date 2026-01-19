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
    businessInfoCompleted: { type: Boolean, default: false },
    businessInfoCompletedAt: { type: Date },
    wabaConnectionInitiated: { type: Boolean, default: false },
    wabaConnectionInitiatedAt: { type: Date },
    wabaConnectionCompleted: { type: Boolean, default: false },
    wabaConnectionCompletedAt: { type: Date },
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
  whatsappAccessToken: { type: String },
  whatsappPhoneNumberId: { type: String },
  whatsappPhoneNumber: { type: String }, // Actual phone number like +919876543210
  wabaId: { type: String },
  businessId: { type: String }, // Meta Business ID
  businessAccountId: { type: String },
  whatsappVerifyToken: { type: String },
  connectedAt: { type: Date },
  whatsappConnected: { type: Boolean, default: false }, // Quick check if WhatsApp is connected
  
  // Phone metadata (BSP model - synced from Meta)
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
// BSP MULTI-TENANT INDEXES
// ═══════════════════════════════════════════════════════════════════

// Index for finding all workspaces under a BSP WABA
WorkspaceSchema.index({ bspWabaId: 1, bspManaged: 1 });

// Index for quality/status monitoring
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
