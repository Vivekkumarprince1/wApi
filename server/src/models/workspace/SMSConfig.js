const mongoose = require('mongoose');

const SMSConfigSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    unique: true
  },
  provider: {
    type: String,
    enum: ['GUPSHUP', 'MSG91', 'INTERAKT_DIRECT'],
    default: 'GUPSHUP'
  },
  credentials: {
    apiKey: String,
    senderId: String,   // 6-character Header (e.g. WAPIAP)
    entityId: String,   // DLT Entity ID (for India)
    templateId: String, // DLT Template ID (for India)
    endpoint: String
  },
  status: {
    type: String,
    enum: ['PENDING', 'ACTIVE', 'ERROR'],
    default: 'PENDING'
  },
  lastTestedAt: Date,
  errorDetail: String
}, { timestamps: true });

module.exports = mongoose.model('SMSConfig', SMSConfigSchema);
