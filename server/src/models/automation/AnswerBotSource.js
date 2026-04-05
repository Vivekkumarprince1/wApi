const mongoose = require('mongoose');

/**
 * AnswerBotSource Model
 * Tracks website URLs crawled by AnswerBot and their status
 */
const AnswerBotSourceSchema = new mongoose.Schema({
  workspace: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },

  // Type of Knowledge Base Source
  sourceType: {
    type: String,
    enum: ['url', 'document', 'text'],
    default: 'url',
    index: true
  },
  
  // Custom title to identify the source
  title: {
    type: String
  },

  // Website URL to crawl
  websiteUrl: {
    type: String,
    required: function() { return this.sourceType === 'url'; },
    validate: {
      validator: function(v) {
        if (this.sourceType !== 'url') return true;
        try {
          new URL(v);
          return true;
        } catch (e) {
          return false;
        }
      },
      message: 'Invalid URL format'
    }
  },

  // Status of the crawl/processing
  crawlStatus: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'failed'],
    default: 'pending',
    index: true
  },

  // Raw text content for 'text' sources
  textContent: {
    type: String
  },

  // Metadata for 'document' sources
  documentData: {
    fileName: String,
    fileUrl: String,
    fileSize: Number,
    mimeType: String
  },

  // Number of FAQs generated from this source
  faqCount: {
    type: Number,
    default: 0
  },

  // Error message if crawl failed
  errorMessage: String,

  // Metadata from crawl
  metadata: {
    pagesCrawled: {
      type: Number,
      default: 0
    },

    totalPages: Number,

    questionsFound: {
      type: Number,
      default: 0
    },

    crawlDurationMs: Number,

    lastCrawledAt: Date
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },

  updatedAt: {
    type: Date,
    default: Date.now
  },

  completedAt: Date,

  deletedAt: Date // Soft delete
});

// Indexes
AnswerBotSourceSchema.index({ workspace: 1, crawlStatus: 1 });
AnswerBotSourceSchema.index({ workspace: 1, createdAt: -1 });
// Remove the strict unique index on websiteUrl since it might be null for documents/text
// We can use a compound sparse index if needed.
AnswerBotSourceSchema.index({ workspace: 1, websiteUrl: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('AnswerBotSource', AnswerBotSourceSchema);
