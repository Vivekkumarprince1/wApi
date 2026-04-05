const mongoose = require('mongoose');

const WhatsAppFormSchema = new mongoose.Schema({
  workspace: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['draft', 'published'],
    default: 'draft',
    index: true
  },
  // Native WhatsApp Flow Support
  flowType: {
    type: String,
    enum: ['static', 'dynamic'],
    default: 'static'
  },
  
  // Facebook Business Manager integration fields
  flowId: {
    type: String,     // Official Meta Flow ID
    index: true
  },
  flowVersion: {
    type: String,
    default: '1.0'
  },
  
  // The actual JSON Payload compatible with Meta's Flow JSON model.
  screens: [{
    id: String,           // e.g "SIGN_UP_SCREEN"
    title: String,        // Optional Top Bar title
    layout: {
      type: { type: String, enum: ['SingleColumnLayout'], default: 'SingleColumnLayout' },
      children: [mongoose.Schema.Types.Mixed] // Elements: Text, TextInput, Dropdown, CheckboxGroup, etc.
    },
    // Meta endpoints specify `data` payload here for dynamic screens
    data: mongoose.Schema.Types.Mixed,
    terminal: { type: Boolean, default: false }, // Terminal screens end the flow
  }],

  // If they pasted a pure raw Facebook JSON (e.g. from FB Playground)
  rawFlowJson: {
    type: mongoose.Schema.Types.Mixed
  },
  
  // Mapping logic from Flow Response to Interakt CRM variables
  dataMapping: [{
    flowFieldId: String,  // Checkbox name or Input ID in the flow
    crmField: String,     // e.g., 'email', 'firstName', 'tags'
    saveAsTrait: Boolean
  }],

  // For dynamic forms hitting customer's APIs
  webhookConfig: {
    enabled: { type: Boolean, default: false },
    url: String,
    method: { type: String, default: 'POST' },
    headers: mongoose.Schema.Types.Mixed
  },

  // Form configuration & Fallbacks
  config: {
    fallbackMessage: { type: String, default: 'Please update your WhatsApp to use interactive forms.' },
    sendConfirmationMessage: { type: Boolean, default: true },
    confirmationText: String
  },

  // Statistics
  statistics: {
    totalResponses: { type: Number, default: 0 },
    completedResponses: { type: Number, default: 0 },
    abandonedResponses: { type: Number, default: 0 },
    totalStarts: { type: Number, default: 0 },
    completionRate: { type: Number, default: 0 },
    lastResponseAt: Date,
    averageTimeSpent: Number        // In seconds
  },

  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  publishedAt: Date,
  publishedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Tags and categorization
  tags: [String],
  category: String,

  // Tracking
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  deletedAt: Date
});


// Indexes for queries
WhatsAppFormSchema.index({ workspace: 1, status: 1 });
WhatsAppFormSchema.index({ workspace: 1, createdAt: -1 });
WhatsAppFormSchema.index({ workspace: 1, name: 'text' });

module.exports = mongoose.model('WhatsAppForm', WhatsAppFormSchema);
