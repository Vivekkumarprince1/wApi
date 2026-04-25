const mongoose = require('mongoose');

const AnswerBotSettingsSchema = new mongoose.Schema({
  workspace: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    unique: true,
    index: true
  },
  enabled: {
    type: Boolean,
    default: false
  },
  personaName: {
    type: String,
    default: 'Smart Assistant'
  },
  systemPrompt: {
    type: String,
    default: 'You are a helpful customer support assistant. Only use the provided Knowledge Base to answer questions.'
  },
  aiModel: {
    type: String,
    enum: ['gpt-3.5-turbo', 'gpt-4', 'claude-3-haiku'],
    default: 'gpt-3.5-turbo'
  },
  fallbackAction: {
    type: String,
    enum: ['assign_to_agent', 'send_fallback_message'],
    default: 'send_fallback_message'
  },
  fallbackMessage: {
    type: String,
    default: "I'm sorry, I couldn't find the answer to your question. Let me connect you with a team member."
  },
  fallbackAgentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Used if only interacting on certain channels
  allowedChannels: {
    type: [String],
    default: ['whatsapp', 'instagram']
  }
}, { timestamps: true });

module.exports = mongoose.model('AnswerBotSettings', AnswerBotSettingsSchema);
