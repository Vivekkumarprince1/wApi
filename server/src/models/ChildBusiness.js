const mongoose = require('mongoose');

/**
 * ChildBusiness Model
 *
 * Represents a customer business onboarded via Embedded Signup.
 * Each child business owns a phone number asset under the Parent WABA.
 */
const ChildBusinessSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  parentWaba: { type: mongoose.Schema.Types.ObjectId, ref: 'ParentWABA', required: true, index: true },

  // Meta identifiers
  customerBusinessId: { type: String },
  wabaId: { type: String },
  childWabaId: { type: String },
  parentWabaId: { type: String },

  // Phone number asset
  phoneNumberId: { type: String, required: true, unique: true, index: true },
  displayPhoneNumber: { type: String },
  verifiedName: { type: String },

  // Lifecycle state (required by BSP SaaS)
  phoneStatus: {
    type: String,
    enum: ['pending', 'verified', 'display_name_approved', 'active', 'restricted', 'disabled'],
    default: 'pending'
  },
  statusReason: { type: String },
  lastStatusUpdateAt: { type: Date },

  // Quality tracking
  qualityRating: { type: String, enum: ['GREEN', 'YELLOW', 'RED', 'UNKNOWN'], default: 'UNKNOWN' },
  lastQualityUpdateAt: { type: Date },

  // Meta metadata
  messagingLimitTier: { type: String },
  codeVerificationStatus: { type: String },
  nameStatus: { type: String },
  isOfficialAccount: { type: Boolean, default: false },
  accountMode: { type: String },

  // Compliance tracking
  webhooksSubscribedAt: { type: Date },
  onboardedAt: { type: Date, default: Date.now },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

ChildBusinessSchema.index({ parentWaba: 1, phoneNumberId: 1 });
ChildBusinessSchema.index({ workspace: 1, phoneStatus: 1 });

ChildBusinessSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('ChildBusiness', ChildBusinessSchema);
