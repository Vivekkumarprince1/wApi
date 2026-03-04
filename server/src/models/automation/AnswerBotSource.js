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

  // Website URL to crawl
  websiteUrl: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
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

  // Status of the crawl
  crawlStatus: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'failed'],
    default: 'pending',
    index: true
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
AnswerBotSourceSchema.index({ workspace: 1, websiteUrl: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('AnswerBotSource', AnswerBotSourceSchema);
