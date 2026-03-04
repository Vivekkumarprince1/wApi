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
  // Form structure - array of questions
  questions: [{
    id: String,                    // Unique ID for this question
    type: {
      type: String,
      enum: ['text', 'choice', 'number', 'email', 'phone'],
      default: 'text'
    },
    title: String,                 // Question text
    description: String,           // Optional hint/description
    required: { type: Boolean, default: true },
    placeholder: String,
    // For choice type
    options: [{
      id: String,
      label: String,
      value: String
    }],
    // Validation
    minLength: Number,
    maxLength: Number,
    pattern: String,              // Regex pattern for validation
    // Logic
    conditional: {
      enabled: { type: Boolean, default: false },
      dependsOn: String,          // Question ID it depends on
      dependsOnValue: String,     // Value that triggers this question
    },
    // UI
    position: Number
  }],

  // Form configuration
  config: {
    intro: {
      enabled: { type: Boolean, default: true },
      title: String,
      message: String
    },
    outro: {
      enabled: { type: Boolean, default: true },
      title: String,
      message: String
    },
    requirePhone: { type: Boolean, default: true },
    saveLead: { type: Boolean, default: true },
    sendConfirmation: { type: Boolean, default: true },
    confirmationMessage: String,
    includeQuestionsSummary: { type: Boolean, default: true }
  },

  // Form behavior
  behavior: {
    allowSkip: { type: Boolean, default: false },
    allowRestart: { type: Boolean, default: true },
    sessionTimeout: { type: Number, default: 3600 },  // Seconds
    retryLimit: { type: Number, default: 3 },
    progressBar: { type: Boolean, default: true }
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
