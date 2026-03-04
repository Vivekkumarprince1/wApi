const mongoose = require('mongoose');

/**
 * FAQ Model
 * Stores FAQs generated from AnswerBot website crawling
 * Used for automatic WhatsApp responses
 */
const FAQSchema = new mongoose.Schema({
  workspace: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },

  // The main question
  question: {
    type: String,
    required: true
  },

  // The answer
  answer: {
    type: String,
    required: true
  },

  // Alternative phrasings of the question for matching
  variations: {
    type: [String],
    default: []
  },

  // Status of this FAQ
  status: {
    type: String,
    enum: ['draft', 'approved'],
    default: 'draft',
    index: true
  },

  // Source of this FAQ
  source: {
    type: String,
    enum: ['answerbot', 'manual'],
    default: 'answerbot'
  },

  // Reference to the source crawl if from AnswerBot
  answerBotSource: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AnswerBotSource'
  },

  // Statistics
  matchCount: {
    type: Number,
    default: 0
  },

  lastMatchedAt: Date,

  // Metadata
  createdAt: {
    type: Date,
    default: Date.now
  },

  updatedAt: {
    type: Date,
    default: Date.now
  },

  deletedAt: Date // Soft delete
});

// Indexes for fast querying
FAQSchema.index({ workspace: 1, status: 1 });
FAQSchema.index({ workspace: 1, source: 1 });
FAQSchema.index({ workspace: 1, createdAt: -1 });

// Text index for searching questions and answers
FAQSchema.index({ question: 'text', answer: 'text', variations: 'text' });

module.exports = mongoose.model('FAQ', FAQSchema);
