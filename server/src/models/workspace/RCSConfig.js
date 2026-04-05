const mongoose = require('mongoose');

const RCSConfigSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    unique: true
  },
  provider: {
    type: String,
    enum: ['JIO', 'GUPSHUP', 'META_RCS'],
    default: 'JIO'
  },
  credentials: {
    apiKey: String,
    apiSecret: String,
    senderId: String,
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

module.exports = mongoose.model('RCSConfig', RCSConfigSchema);
