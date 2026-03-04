const mongoose = require('mongoose');

const WhatsAppAdSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  
  // ✅ Basic Info
  name: { type: String, required: true },
  objective: { type: String, enum: ['MESSAGES'], default: 'MESSAGES' }, // Click-to-WhatsApp only
  
  // ✅ Meta Ad IDs (idempotency tracking)
  metaCampaignId: { type: String },
  metaAdSetId: { type: String },
  metaAdCreativeId: { type: String },
  metaAdId: { type: String },
  
  // ✅ Budget & Schedule
  budget: { type: Number, required: true }, // Daily budget in cents (e.g., 500 = $5.00)
  currency: { type: String, default: 'USD' },
  scheduleStart: { type: Date, required: true },
  scheduleEnd: { type: Date },
  isScheduled: { type: Boolean, default: false },
  
  // ✅ Targeting (basic)
  targeting: {
    ageMin: { type: Number, default: 18 },
    ageMax: { type: Number, default: 65 },
    genders: [{ type: String, enum: ['MALE', 'FEMALE', 'ALL'] }], // MALE=1, FEMALE=2, ALL=3
    countries: [{ type: String }], // ISO country codes
    languages: [{ type: String }], // ISO language codes
    interests: [{ type: String }], // Interest IDs from Meta
    behaviors: [{ type: String }], // Behavior IDs from Meta
    customAudiences: [{ type: String }], // Custom audience IDs
    lookalikeLevels: [{ type: Number }], // 1-10 lookalike similarity
    excludedAudiences: [{ type: String }] // Excluded audience IDs
  },
  
  // ✅ Template & Welcome Message
  template: { type: mongoose.Schema.Types.ObjectId, ref: 'Template', required: true }, // Must be APPROVED
  templateVariableMapping: { type: Object, default: {} }, // Maps template vars to context
  welcomeMessage: { type: String }, // Custom welcome message for chat window
  
  // ✅ CTA & Linking
  phoneNumberId: { type: String, required: true }, // Meta phone number ID (from WABA)
  ctaText: { type: String, default: 'Message us' },
  displayFormat: { type: String, enum: ['TEXT', 'CAROUSEL'], default: 'TEXT' },
  
  // ✅ Status & Tracking
  status: { 
    type: String, 
    enum: ['draft', 'pending_review', 'active', 'paused', 'rejected', 'completed', 'error'], 
    default: 'draft' 
  },
  metaStatus: { type: String }, // Raw Meta status (ACTIVE, PAUSED, DELETED, PENDING_REVIEW, etc)
  metaStatusUpdatedAt: { type: Date },
  
  // ✅ Auto-pause tracking
  pausedReason: { type: String }, // TEMPLATE_REVOKED, ACCOUNT_BLOCKED, TOKEN_EXPIRED, SPEND_LIMIT_REACHED, CAPABILITY_REVOKED, SUBSCRIPTION_INACTIVE, MANUAL_PAUSE
  pausedAt: { type: Date },
  pausedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // User who paused manually
  
  // ✅ Rejection tracking
  rejectionReason: { type: String }, // Reason from Meta review
  rejectedAt: { type: Date },
  rejectionDetails: { type: Object }, // Additional rejection details from Meta
  
  // ✅ Spend tracking
  spentAmount: { type: Number, default: 0 }, // Total spent in cents
  spentAmountUpdatedAt: { type: Date },
  impressions: { type: Number, default: 0 },
  clicks: { type: Number, default: 0 },
  conversions: { type: Number, default: 0 },
  ctr: { type: Number, default: 0 }, // Click-through rate
  cpc: { type: Number, default: 0 }, // Cost per click
  
  // ✅ Audit & Logging
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  
  // ✅ Meta API request/response logging
  metaApiLogs: [{
    timestamp: { type: Date, default: Date.now },
    action: String, // create_campaign, create_ad_set, create_creative, create_ad, update_ad, etc
    request: mongoose.Schema.Types.Mixed,
    response: mongoose.Schema.Types.Mixed,
    error: String,
    metaRequestId: String
  }]
});

// Indexes for performance
WhatsAppAdSchema.index({ workspace: 1, status: 1 });
WhatsAppAdSchema.index({ workspace: 1, createdAt: -1 });
WhatsAppAdSchema.index({ metaCampaignId: 1 }, { sparse: true });
WhatsAppAdSchema.index({ metaAdId: 1 }, { sparse: true });

// Update the updatedAt timestamp on save
WhatsAppAdSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('WhatsAppAd', WhatsAppAdSchema);
