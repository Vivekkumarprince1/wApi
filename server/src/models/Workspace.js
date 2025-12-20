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
    notes: { type: String }
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
  businessAccountId: { type: String },
  whatsappVerifyToken: { type: String },
  connectedAt: { type: Date },
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
    templates: { type: Number, default: 0 },
    campaigns: { type: Number, default: 0 },
    automations: { type: Number, default: 0 }
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

// Update the updatedAt timestamp on save
WorkspaceSchema.pre('save', function(next) {
  this.updatedAt = new Date();

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

module.exports = mongoose.model('Workspace', WorkspaceSchema);
