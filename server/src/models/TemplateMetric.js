const mongoose = require('mongoose');

/**
 * TemplateMetric Schema
 * Tracks every template creation, rejection, and approval
 * Used by templateAbuseService to detect bad actors
 */

const TemplateMetricSchema = new mongoose.Schema(
  {
    // Identification
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    phoneNumberId: {
      type: String,
      required: true,
      index: true,
    },
    templateName: {
      type: String,
      required: true,
      index: true,
    },

    // Content
    contentHash: {
      type: String,
      required: true,
      // MD5 hash of template content for deduplication
    },

    // Status tracking
    status: {
      type: String,
      enum: ['created', 'rejected', 'approved', 'disabled'],
      default: 'created',
      index: true,
    },

    // Rejection metadata
    rejectionReason: {
      type: String,
      default: null,
      // "INVALID_PLACEHOLDERS" | "INAPPROPRIATE_CONTENT" | etc.
    },
    retryCount: {
      type: Number,
      default: 0,
      // How many times this template was rejected and retried
    },

    // Timestamps
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    approvedAt: {
      type: Date,
      default: null,
    },

    // TTL: Auto-delete after 90 days
  },
  {
    timestamps: false,
  }
);

// TTL Index: Auto-delete records after 90 days
TemplateMetricSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days

module.exports = mongoose.model('TemplateMetric', TemplateMetricSchema);
