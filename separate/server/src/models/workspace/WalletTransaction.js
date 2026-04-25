const mongoose = require('mongoose');

const WalletTransactionSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['RECHARGE', 'PARK', 'UNPARK', 'SPEND', 'REFUND'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'INR'
  },
  referenceType: {
    type: String,
    enum: ['CAMPAIGN', 'MANUAL', 'SYSTEM'],
    required: true
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'referenceTypeModel'
  },
  referenceTypeModel: {
    type: String,
    enum: ['Campaign', 'User', 'Workspace']
  },
  status: {
    type: String,
    enum: ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'],
    default: 'COMPLETED'
  },
  description: String,
  metadata: mongoose.Schema.Types.Mixed
}, { timestamps: true });

module.exports = mongoose.model('WalletTransaction', WalletTransactionSchema);
