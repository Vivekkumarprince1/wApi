const mongoose = require('mongoose');

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * INTERAKT-STYLE TEMPLATE MODEL
 * 
 * Comprehensive template schema for WhatsApp Cloud API compliance.
 * Supports header, body, footer, and buttons with full Meta validation.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// Valid Meta categories - only these 3 are accepted by WhatsApp API
const VALID_META_CATEGORIES = ['MARKETING', 'UTILITY', 'AUTHENTICATION'];

// Map legacy/invalid categories to valid ones
const CATEGORY_MAP = {
  'PROMOTIONAL': 'MARKETING',
  'TRANSACTIONAL': 'UTILITY',
  'SERVICE': 'UTILITY',
  'OTP': 'AUTHENTICATION'
};

// Supported languages with their Meta codes
const SUPPORTED_LANGUAGES = {
  'en': 'English',
  'en_US': 'English (US)',
  'en_GB': 'English (UK)',
  'es': 'Spanish',
  'es_ES': 'Spanish (Spain)',
  'es_MX': 'Spanish (Mexico)',
  'pt_BR': 'Portuguese (Brazil)',
  'pt_PT': 'Portuguese (Portugal)',
  'fr': 'French',
  'de': 'German',
  'it': 'Italian',
  'hi': 'Hindi',
  'ar': 'Arabic',
  'zh_CN': 'Chinese (Simplified)',
  'zh_TW': 'Chinese (Traditional)',
  'ja': 'Japanese',
  'ko': 'Korean',
  'ru': 'Russian',
  'tr': 'Turkish',
  'id': 'Indonesian',
  'ms': 'Malay',
  'th': 'Thai',
  'vi': 'Vietnamese',
  'nl': 'Dutch',
  'pl': 'Polish',
  'uk': 'Ukrainian',
  'he': 'Hebrew'
};

// ═══════════════════════════════════════════════════════════════════════════════
// APPROVAL HISTORY SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

const ApprovalHistorySchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED', 'IN_APPEAL'],
    required: true
  },
  reason: { type: String },
  timestamp: { type: Date, default: Date.now },
  metaEventId: { type: String },
  rawEvent: { type: mongoose.Schema.Types.Mixed }
}, { _id: false });

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN TEMPLATE SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

const TemplateSchema = new mongoose.Schema({
  // ─────────────────────────────────────────────────────────────────────────────
  // WORKSPACE & OWNERSHIP
  // ─────────────────────────────────────────────────────────────────────────────
  workspace: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  parentWaba: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ParentWABA',
    index: true
  },
  parentWabaId: { type: String, index: true },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // TEMPLATE IDENTITY
  // ─────────────────────────────────────────────────────────────────────────────
  name: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    match: [/^[a-z0-9_]+$/, 'Template name can only contain lowercase letters, numbers, and underscores']
  },
  displayName: {
    type: String,
    trim: true
  },
  language: {
    type: String,
    default: 'en',
    enum: Object.keys(SUPPORTED_LANGUAGES)
  },
  category: {
    type: String,
    enum: ['MARKETING', 'UTILITY', 'AUTHENTICATION'],
    required: true,
    default: 'MARKETING'
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // STRUCTURED COMPONENTS (Interakt-style)
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Header component (optional)
   * Can be TEXT, IMAGE, VIDEO, or DOCUMENT
   */
  header: {
    enabled: { type: Boolean, default: false },
    format: {
      type: String,
      enum: ['NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'],
      default: 'NONE'
    },
    text: { type: String, maxlength: 60 },
    mediaUrl: { type: String },
    mediaHandle: { type: String }, // Meta asset handle
    variables: [String],
    example: { type: String }
  },

  /**
   * Body component (required)
   * Main message text with variable support
   */
  body: {
    text: {
      type: String,
      required: true,
      maxlength: 1024
    },
    variables: [String],
    examples: [String] // Example values for each variable
  },

  /**
   * Footer component (optional)
   * Simple text, no variables allowed
   */
  footer: {
    enabled: { type: Boolean, default: false },
    text: { type: String, maxlength: 60 }
  },

  /**
   * Buttons component (optional)
   * Max 3 buttons for MARKETING/UTILITY, special rules for AUTHENTICATION
   */
  buttons: {
    enabled: { type: Boolean, default: false },
    items: [{
      type: {
        type: String,
        enum: ['QUICK_REPLY', 'URL', 'PHONE_NUMBER', 'COPY_CODE'],
        required: true
      },
      text: { type: String, required: true, maxlength: 25 },
      url: { type: String },
      urlSuffix: { type: String }, // Dynamic URL suffix variable
      phoneNumber: { type: String },
      example: { type: String } // For URL variables or OTP
    }]
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // META API COMPONENTS (Raw format for API submission)
  // ─────────────────────────────────────────────────────────────────────────────
  components: {
    type: Array,
    default: []
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // META/BSP IDENTIFIERS
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Meta template ID (returned after creation)
   */
  metaTemplateId: { type: String },
  
  /**
   * Legacy field for backward compatibility
   */
  providerId: { type: String },

  /**
   * Namespaced template name on Meta (BSP model)
   * Format: {workspaceIdSuffix}_{templateName}
   */
  metaTemplateName: { type: String },

  /**
   * Submission method
   */
  submittedVia: {
    type: String,
    enum: ['BSP', 'DIRECT', 'MANUAL', null],
    default: null
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // STATUS & APPROVAL
  // ─────────────────────────────────────────────────────────────────────────────
  status: {
    type: String,
    enum: [
      'DRAFT',           // Local only, not submitted
      'PENDING',         // Submitted, awaiting approval
      'APPROVED',        // Approved by Meta
      'REJECTED',        // Rejected by Meta
      'PAUSED',          // Temporarily paused
      'DISABLED',        // Disabled by Meta
      'IN_APPEAL',       // Rejection appealed
      'PENDING_DELETION', // Deletion requested
      'DELETED',         // Deleted from Meta
      'LIMIT_EXCEEDED'   // Quality limit exceeded
    ],
    default: 'DRAFT',
    index: true
  },

  /**
   * Current rejection reason (if rejected)
   */
  rejectionReason: { type: String },

  /**
   * Detailed rejection info from Meta
   */
  rejectionDetails: {
    reason: { type: String },
    code: { type: String },
    description: { type: String },
    timestamp: { type: Date }
  },

  /**
   * Complete approval history
   */
  approvalHistory: [ApprovalHistorySchema],

  /**
   * Quality rating from Meta
   */
  qualityScore: {
    type: String,
    enum: ['GREEN', 'YELLOW', 'RED', 'UNKNOWN'],
    default: 'UNKNOWN'
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // PARAMETER FORMAT
  // ─────────────────────────────────────────────────────────────────────────────
  parameterFormat: {
    type: String,
    enum: ['POSITIONAL', 'NAMED'],
    default: 'POSITIONAL'
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // EXTRACTED DATA (For quick access)
  // ─────────────────────────────────────────────────────────────────────────────
  variables: [String], // All variables extracted from all components
  variableCount: { type: Number, default: 0 },

  // Preview fields for quick display
  headerText: { type: String },
  bodyText: { type: String },
  footerText: { type: String },
  buttonLabels: [String],
  preview: { type: String }, // Full preview text

  // ─────────────────────────────────────────────────────────────────────────────
  // VERSIONING (Stage 2 Enhancement)
  // ─────────────────────────────────────────────────────────────────────────────
  /**
   * Template version - incremented on each edit
   * Used for tracking changes and conflict detection
   */
  version: {
    type: Number,
    default: 1
  },
  
  /**
   * Last edit metadata
   */
  lastEditedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastEditedAt: { type: Date },

  // ─────────────────────────────────────────────────────────────────────────────
  // VERSION FORKING (Stage 2 Hardening - Task A)
  // ─────────────────────────────────────────────────────────────────────────────
  /**
   * Reference to original approved template (when forking)
   * If set, this template is a fork/edit of an approved version
   */
  originalTemplateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Template'
  },
  
  /**
   * Whether this template is the currently active approved version
   * Used when multiple versions exist (original + forks)
   */
  isActiveVersion: {
    type: Boolean,
    default: true
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // META PAYLOAD SNAPSHOT (Stage 2 Hardening - Task B)
  // ─────────────────────────────────────────────────────────────────────────────
  /**
   * Exact payload sent to Meta API for audit/debug
   * Immutable after submission - never mutate
   */
  metaPayloadSnapshot: {
    components: { type: Array },
    name: { type: String },
    language: { type: String },
    category: { type: String },
    submittedAt: { type: Date },
    raw: { type: mongoose.Schema.Types.Mixed }
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // USAGE TRACKING (Stage 2 Hardening - Task C)
  // ─────────────────────────────────────────────────────────────────────────────
  /**
   * Number of campaigns using this template
   * Prevents deletion if > 0
   */
  usedInCampaigns: {
    type: Number,
    default: 0
  },
  
  /**
   * Last time template was used for sending
   */
  lastUsedAt: { type: Date },

  // ─────────────────────────────────────────────────────────────────────────────
  // WEBHOOK STATE (Stage 2 Hardening - Task D)
  // ─────────────────────────────────────────────────────────────────────────────
  /**
   * Timestamp of last webhook status update
   * Used for idempotency and race condition prevention
   */
  lastWebhookUpdate: { type: Date },
  
  /**
   * Event ID from last webhook for deduplication
   */
  lastWebhookEventId: { type: String },

  // ─────────────────────────────────────────────────────────────────────────────
  // METADATA
  // ─────────────────────────────────────────────────────────────────────────────
  source: {
    type: String,
    enum: ['META', 'LOCAL'],
    default: 'LOCAL'
  },
  
  isSystemGenerated: { type: Boolean, default: false },
  generationSource: {
    type: String,
    enum: ['onboarding', 'scheduled', 'manual', 'duplicate', null],
    default: null
  },
  duplicatedFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Template'
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // TIMESTAMPS
  // ─────────────────────────────────────────────────────────────────────────────
  lastSyncedAt: { type: Date },
  submittedAt: { type: Date },
  approvedAt: { type: Date },
  rejectedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// ═══════════════════════════════════════════════════════════════════════════════
// INDEXES
// ═══════════════════════════════════════════════════════════════════════════════

TemplateSchema.index({ workspace: 1, name: 1 }, { unique: true });
TemplateSchema.index({ workspace: 1, status: 1 });
TemplateSchema.index({ workspace: 1, category: 1 });
TemplateSchema.index({ metaTemplateName: 1 }, { sparse: true });
TemplateSchema.index({ metaTemplateId: 1 }, { sparse: true });
TemplateSchema.index({ createdAt: -1 });

// ═══════════════════════════════════════════════════════════════════════════════
// PRE-SAVE HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

TemplateSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // ─────────────────────────────────────────────────────────────────────────────
  // VERSION INCREMENT (Stage 2 Enhancement)
  // Increment version on content changes for DRAFT/REJECTED templates
  // ─────────────────────────────────────────────────────────────────────────────
  if (this.isModified('body.text') || this.isModified('header') || 
      this.isModified('footer') || this.isModified('buttons')) {
    if (this.status === 'DRAFT' || this.status === 'REJECTED') {
      this.version = (this.version || 0) + 1;
      this.lastEditedAt = new Date();
    }
  }
  
  // Extract variables from body
  if (this.body?.text) {
    const bodyVars = this.body.text.match(/\{\{(\d+)\}\}/g) || [];
    this.body.variables = bodyVars.map(v => v.replace(/[{}]/g, ''));
  }
  
  // Extract variables from header if TEXT
  if (this.header?.enabled && this.header?.format === 'TEXT' && this.header?.text) {
    const headerVars = this.header.text.match(/\{\{(\d+)\}\}/g) || [];
    this.header.variables = headerVars.map(v => v.replace(/[{}]/g, ''));
  }
  
  // Combine all variables
  const allVars = new Set([
    ...(this.body?.variables || []),
    ...(this.header?.variables || [])
  ]);
  this.variables = Array.from(allVars).sort((a, b) => parseInt(a) - parseInt(b));
  this.variableCount = this.variables.length;
  
  // Update preview fields
  this.headerText = this.header?.enabled ? this.header.text : null;
  this.bodyText = this.body?.text;
  this.footerText = this.footer?.enabled ? this.footer.text : null;
  this.buttonLabels = this.buttons?.enabled 
    ? this.buttons.items.map(b => b.text) 
    : [];
  
  // Build full preview
  let preview = '';
  if (this.headerText) preview += `[Header] ${this.headerText}\n`;
  preview += this.bodyText || '';
  if (this.footerText) preview += `\n[Footer] ${this.footerText}`;
  this.preview = preview;
  
  // Sync providerId with metaTemplateId for backward compatibility
  if (this.metaTemplateId && !this.providerId) {
    this.providerId = this.metaTemplateId;
  }
  if (this.providerId && !this.metaTemplateId) {
    this.metaTemplateId = this.providerId;
  }
  
  next();
});

// ═══════════════════════════════════════════════════════════════════════════════
// STATIC METHODS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get valid Meta category
 */
TemplateSchema.statics.getValidMetaCategory = function(category) {
  if (VALID_META_CATEGORIES.includes(category)) {
    return category;
  }
  return CATEGORY_MAP[category] || 'MARKETING';
};

/**
 * Get supported languages
 */
TemplateSchema.statics.getSupportedLanguages = function() {
  return SUPPORTED_LANGUAGES;
};

/**
 * Find template by Meta template name (for webhook routing)
 */
TemplateSchema.statics.findByMetaTemplateName = async function(metaTemplateName) {
  return this.findOne({ metaTemplateName });
};

/**
 * Find templates by workspace with status filter
 */
TemplateSchema.statics.findByWorkspace = async function(workspaceId, options = {}) {
  const query = { workspace: workspaceId };
  
  if (options.status) {
    query.status = options.status;
  }
  
  if (options.category) {
    query.category = options.category;
  }
  
  if (options.search) {
    query.$or = [
      { name: { $regex: options.search, $options: 'i' } },
      { displayName: { $regex: options.search, $options: 'i' } },
      { bodyText: { $regex: options.search, $options: 'i' } }
    ];
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .populate('createdBy', 'name email');
};

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE USAGE GUARD METHODS (Stage 2 - Task 6)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get all APPROVED templates for a workspace
 * Use this for template selection in campaigns, auto-replies, workflows
 * @param {ObjectId} workspaceId - The workspace ID
 * @param {Object} options - Filter options { category, search }
 * @returns {Promise<Array>} Array of approved templates
 */
TemplateSchema.statics.getApprovedTemplates = async function(workspaceId, options = {}) {
  const query = {
    workspace: workspaceId,
    status: 'APPROVED'
  };
  
  if (options.category) {
    query.category = options.category;
  }
  
  if (options.language) {
    query.language = options.language;
  }
  
  if (options.search) {
    query.$or = [
      { name: { $regex: options.search, $options: 'i' } },
      { displayName: { $regex: options.search, $options: 'i' } },
      { bodyText: { $regex: options.search, $options: 'i' } }
    ];
  }
  
  return this.find(query)
    .select('name displayName language category variableCount preview metaTemplateName qualityScore')
    .sort({ approvedAt: -1 })
    .lean();
};

/**
 * Get an approved template by ID (with validation)
 * Returns null if template is not approved - prevents accidental use of non-approved templates
 * @param {ObjectId} templateId - The template ID
 * @param {ObjectId} workspaceId - The workspace ID (for security)
 * @returns {Promise<Object|null>} Template if approved, null otherwise
 */
TemplateSchema.statics.getApprovedTemplateById = async function(templateId, workspaceId) {
  const template = await this.findOne({
    _id: templateId,
    workspace: workspaceId,
    status: 'APPROVED'
  });
  
  return template;
};

/**
 * Validate that a template is approved for sending
 * Throws descriptive errors for non-approved templates
 * @param {ObjectId} templateId - The template ID
 * @param {ObjectId} workspaceId - The workspace ID
 * @returns {Promise<Object>} Approved template document
 * @throws {Error} If template not found, not owned by workspace, or not approved
 */
TemplateSchema.statics.requireApprovedTemplate = async function(templateId, workspaceId) {
  const template = await this.findOne({
    _id: templateId,
    workspace: workspaceId
  });
  
  if (!template) {
    const error = new Error('TEMPLATE_NOT_FOUND: Template does not exist or is not accessible');
    error.code = 'TEMPLATE_NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }
  
  if (template.status !== 'APPROVED') {
    const statusMessages = {
      'DRAFT': 'Template has not been submitted for approval. Submit it first.',
      'PENDING': 'Template is pending Meta approval. Please wait.',
      'REJECTED': 'Template was rejected by Meta. Edit and resubmit.',
      'PAUSED': 'Template is temporarily paused by Meta.',
      'DISABLED': 'Template has been disabled by Meta.',
      'DELETED': 'Template has been deleted.',
      'LIMIT_EXCEEDED': 'Template quality limit exceeded.'
    };
    
    const error = new Error(`TEMPLATE_NOT_APPROVED: ${statusMessages[template.status] || 'Template is not approved for sending.'}`);
    error.code = 'TEMPLATE_NOT_APPROVED';
    error.statusCode = 400;
    error.templateStatus = template.status;
    error.templateName = template.name;
    throw error;
  }
  
  return template;
};

/**
 * Get templates by status for workspace
 * Useful for dashboard stats and template management UI
 * @param {ObjectId} workspaceId - The workspace ID
 * @returns {Promise<Object>} Counts by status
 */
TemplateSchema.statics.getStatusCounts = async function(workspaceId) {
  const counts = await this.aggregate([
    { $match: { workspace: workspaceId } },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);
  
  return counts.reduce((acc, { _id, count }) => {
    acc[_id] = count;
    return acc;
  }, {
    DRAFT: 0,
    PENDING: 0,
    APPROVED: 0,
    REJECTED: 0,
    PAUSED: 0,
    DISABLED: 0
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// VERSION FORKING METHODS (Stage 2 Hardening - Task A)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Clone an approved template to create a new editable version
 * The original approved template remains usable and unchanged
 * 
 * @param {ObjectId} templateId - The approved template to clone
 * @param {ObjectId} userId - User creating the clone
 * @returns {Promise<Object>} New template in DRAFT status
 * @throws {Error} If template is not approved or not found
 */
TemplateSchema.statics.cloneApprovedTemplate = async function(templateId, userId) {
  const Template = this;
  
  const originalTemplate = await Template.findById(templateId);
  
  if (!originalTemplate) {
    const error = new Error('TEMPLATE_NOT_FOUND: Template does not exist');
    error.code = 'TEMPLATE_NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }
  
  if (originalTemplate.status !== 'APPROVED') {
    const error = new Error('TEMPLATE_NOT_APPROVED: Only approved templates can be forked for editing');
    error.code = 'TEMPLATE_NOT_APPROVED';
    error.statusCode = 400;
    error.templateStatus = originalTemplate.status;
    throw error;
  }
  
  // Generate new name with version suffix
  const newVersion = originalTemplate.version + 1;
  const baseName = originalTemplate.name.replace(/_v\d+$/, ''); // Remove existing version suffix
  const newName = `${baseName}_v${newVersion}`;
  
  // Check if name already exists
  const existingClone = await Template.findOne({
    workspace: originalTemplate.workspace,
    name: newName
  });
  
  if (existingClone) {
    // Return existing draft if available
    if (existingClone.status === 'DRAFT') {
      return { template: existingClone, wasExisting: true };
    }
    
    // Otherwise generate unique name
    const timestamp = Date.now().toString().slice(-4);
    const uniqueName = `${baseName}_v${newVersion}_${timestamp}`;
    return createClone(originalTemplate, uniqueName, newVersion, userId);
  }
  
  return createClone(originalTemplate, newName, newVersion, userId);
  
  async function createClone(original, name, version, creatorId) {
    const clonedTemplate = new Template({
      workspace: original.workspace,
      name: name,
      displayName: original.displayName ? `${original.displayName} (v${version})` : null,
      language: original.language,
      category: original.category,
      header: original.header,
      body: original.body,
      footer: original.footer,
      buttons: original.buttons,
      parameterFormat: original.parameterFormat,
      // New version metadata
      status: 'DRAFT',
      version: version,
      originalTemplateId: original._id,
      isActiveVersion: false, // Original remains active until this is approved
      // Ownership
      createdBy: creatorId,
      lastEditedBy: creatorId,
      source: 'LOCAL',
      generationSource: 'version_fork'
    });
    
    await clonedTemplate.save();
    
    return { template: clonedTemplate, wasExisting: false };
  }
};

/**
 * Get all versions of a template (including forks)
 * @param {ObjectId} templateId - Any version of the template
 * @returns {Promise<Array>} All versions sorted by version number
 */
TemplateSchema.statics.getTemplateVersions = async function(templateId) {
  const Template = this;
  
  const template = await Template.findById(templateId);
  if (!template) return [];
  
  // Get the original template ID
  const originalId = template.originalTemplateId || template._id;
  
  // Find all versions (original + forks)
  const versions = await Template.find({
    $or: [
      { _id: originalId },
      { originalTemplateId: originalId }
    ]
  })
    .sort({ version: 1 })
    .select('name displayName version status approvedAt createdAt isActiveVersion')
    .lean();
  
  return versions;
};

// ═══════════════════════════════════════════════════════════════════════════════
// USAGE TRACKING METHODS (Stage 2 Hardening - Task C)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Increment campaign usage count
 * Call this when a campaign selects this template
 * @param {ObjectId} templateId - Template ID
 * @returns {Promise<Object>} Updated template
 */
TemplateSchema.statics.incrementUsage = async function(templateId) {
  return this.findByIdAndUpdate(
    templateId,
    {
      $inc: { usedInCampaigns: 1 },
      $set: { lastUsedAt: new Date() }
    },
    { new: true }
  );
};

/**
 * Decrement campaign usage count
 * Call this when a campaign removes/changes this template
 * @param {ObjectId} templateId - Template ID
 * @returns {Promise<Object>} Updated template
 */
TemplateSchema.statics.decrementUsage = async function(templateId) {
  return this.findByIdAndUpdate(
    templateId,
    {
      $inc: { usedInCampaigns: -1 }
    },
    { new: true }
  ).then(template => {
    // Ensure count doesn't go negative
    if (template && template.usedInCampaigns < 0) {
      template.usedInCampaigns = 0;
      return template.save();
    }
    return template;
  });
};

/**
 * Check if template can be safely deleted
 * @param {ObjectId} templateId - Template ID
 * @returns {Promise<Object>} { canDelete: boolean, reason?: string, usedInCampaigns?: number }
 */
TemplateSchema.statics.canDeleteTemplate = async function(templateId) {
  const template = await this.findById(templateId);
  
  if (!template) {
    return { canDelete: false, reason: 'Template not found' };
  }
  
  if (template.usedInCampaigns > 0) {
    return {
      canDelete: false,
      reason: `Template is used in ${template.usedInCampaigns} campaign(s). Remove it from campaigns first.`,
      usedInCampaigns: template.usedInCampaigns
    };
  }
  
  return { canDelete: true };
};

// ═══════════════════════════════════════════════════════════════════════════════
// INSTANCE METHODS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if template can be edited
 */
TemplateSchema.methods.canEdit = function() {
  return this.status === 'DRAFT' || this.status === 'REJECTED';
};

/**
 * Check if template can be submitted
 */
TemplateSchema.methods.canSubmit = function() {
  return this.status === 'DRAFT' || this.status === 'REJECTED';
};

/**
 * Check if template can be used for messaging
 */
TemplateSchema.methods.canSend = function() {
  return this.status === 'APPROVED';
};

/**
 * Add status update to history
 */
TemplateSchema.methods.addStatusUpdate = function(status, reason = null, metaEventId = null, rawEvent = null) {
  this.approvalHistory.push({
    status,
    reason,
    metaEventId,
    rawEvent,
    timestamp: new Date()
  });
  
  this.status = status;
  
  if (status === 'APPROVED') {
    this.approvedAt = new Date();
    this.rejectionReason = null;
    this.rejectionDetails = null;
  }
  
  if (status === 'REJECTED') {
    this.rejectedAt = new Date();
    this.rejectionReason = reason;
  }
  
  return this;
};

/**
 * Build Meta API components from structured data
 */
TemplateSchema.methods.buildMetaComponents = function() {
  const components = [];
  
  // Header component
  if (this.header?.enabled && this.header.format !== 'NONE') {
    const headerComponent = {
      type: 'HEADER',
      format: this.header.format
    };
    
    if (this.header.format === 'TEXT') {
      headerComponent.text = this.header.text;
      if (this.header.variables?.length > 0) {
        headerComponent.example = {
          header_text: this.header.example ? [this.header.example] : ['Example']
        };
      }
    } else {
      // Media header
      if (this.header.mediaHandle) {
        headerComponent.example = {
          header_handle: [this.header.mediaHandle]
        };
      }
    }
    
    components.push(headerComponent);
  }
  
  // Body component (required)
  const bodyComponent = {
    type: 'BODY',
    text: this.body.text
  };
  
  if (this.body.variables?.length > 0) {
    const examples = this.body.examples?.length > 0 
      ? this.body.examples 
      : this.body.variables.map((_, i) => `Example${i + 1}`);
    bodyComponent.example = {
      body_text: [examples]
    };
  }
  
  components.push(bodyComponent);
  
  // Footer component
  if (this.footer?.enabled && this.footer.text) {
    components.push({
      type: 'FOOTER',
      text: this.footer.text
    });
  }
  
  // Buttons component
  if (this.buttons?.enabled && this.buttons.items?.length > 0) {
    const buttons = this.buttons.items.map(btn => {
      const button = {
        type: btn.type,
        text: btn.text
      };
      
      if (btn.type === 'URL' && btn.url) {
        button.url = btn.url;
        if (btn.urlSuffix) {
          button.example = [btn.example || 'example'];
        }
      }
      
      if (btn.type === 'PHONE_NUMBER' && btn.phoneNumber) {
        button.phone_number = btn.phoneNumber;
      }
      
      if (btn.type === 'COPY_CODE') {
        button.example = btn.example || '123456';
      }
      
      return button;
    });
    
    components.push({
      type: 'BUTTONS',
      buttons
    });
  }
  
  return components;
};

/**
 * Create a duplicate of this template
 */
TemplateSchema.methods.duplicate = async function(newName, workspaceId = null) {
  const Template = mongoose.model('Template');
  
  const duplicateData = {
    workspace: workspaceId || this.workspace,
    name: newName,
    displayName: `${this.displayName || this.name} (Copy)`,
    language: this.language,
    category: this.category,
    header: this.header,
    body: this.body,
    footer: this.footer,
    buttons: this.buttons,
    status: 'DRAFT',
    source: 'LOCAL',
    duplicatedFrom: this._id,
    generationSource: 'duplicate'
  };
  
  return Template.create(duplicateData);
};

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = mongoose.model('Template', TemplateSchema);
module.exports.VALID_META_CATEGORIES = VALID_META_CATEGORIES;
module.exports.SUPPORTED_LANGUAGES = SUPPORTED_LANGUAGES;
