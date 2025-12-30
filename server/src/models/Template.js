const mongoose = require('mongoose');

// Valid Meta categories - only these 3 are accepted by WhatsApp API
const VALID_META_CATEGORIES = ['MARKETING', 'UTILITY', 'AUTHENTICATION'];

// Map legacy/invalid categories to valid ones
const CATEGORY_MAP = {
  'PROMOTIONAL': 'MARKETING',
  'TRANSACTIONAL': 'UTILITY',
  'SERVICE': 'UTILITY',
  'OTP': 'AUTHENTICATION'
};

const TemplateSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  name: { type: String, required: true },
  language: { type: String, default: 'en' },
  category: { 
    type: String, 
    enum: ['MARKETING', 'UTILITY', 'AUTHENTICATION', 'TRANSACTIONAL', 'PROMOTIONAL', 'SERVICE'], 
    default: 'MARKETING' 
  },
  
  // Template components (header, body, footer, buttons)
  components: { type: Array, default: [] },
  
  // Status from Meta
  status: { 
    type: String, 
    enum: ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED', 'IN_APPEAL', 'PENDING_DELETION', 'DELETED', 'LIMIT_EXCEEDED'], 
    default: 'DRAFT' 
  },
  
  // Meta provider ID (returned when template is created)
  providerId: { type: String },
  
  // Parameter format from Meta (POSITIONAL or NAMED)
  parameterFormat: { type: String, enum: ['POSITIONAL', 'NAMED'], default: 'POSITIONAL' },
  
  // Rejection reason if status is REJECTED
  rejectionReason: { type: String },
  
  // Quality rating from Meta
  qualityScore: { type: String, enum: ['GREEN', 'YELLOW', 'RED', 'UNKNOWN'], default: 'UNKNOWN' },
  
  // Variables extracted from template body
  variables: [String],
  
  // Source of the template
  source: { 
    type: String, 
    enum: ['META', 'LOCAL'], 
    default: 'LOCAL' 
  },
  
  // Preview content for quick display
  headerText: { type: String },
  bodyText: { type: String },
  footerText: { type: String },
  buttonLabels: [String],
  preview: { type: String }, // Short description of what the template does
  
  // Auto-generation tracking
  isSystemGenerated: { type: Boolean, default: false },
  generationSource: { type: String, enum: ['onboarding', 'scheduled', 'manual'], default: null },
  generatedForWorkspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace' },
  generatedAt: { type: Date },
  
  // Metadata
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastSyncedAt: { type: Date },
  submittedAt: { type: Date },
  approvedAt: { type: Date },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Index for faster lookups
TemplateSchema.index({ workspace: 1, name: 1 });
TemplateSchema.index({ workspace: 1, status: 1 });
TemplateSchema.index({ workspace: 1, source: 1 });

// Update timestamp on save
TemplateSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Helper function to get valid Meta category
TemplateSchema.statics.getValidMetaCategory = function(category) {
  if (VALID_META_CATEGORIES.includes(category)) {
    return category;
  }
  return CATEGORY_MAP[category] || 'MARKETING';
};

module.exports = mongoose.model('Template', TemplateSchema);
