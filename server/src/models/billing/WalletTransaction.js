const mongoose = require('mongoose');

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * WALLET TRANSACTION MODEL
 * 
 * Stores all ledger entries for the pre-paid wallet system.
 * High-reliability record for auditing and transparency.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const WalletTransactionSchema = new mongoose.Schema({
  workspace: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    index: true,
    required: true
  },
  type: {
    type: String,
    enum: [
      'RECHARGE',       // Added credits (Razorpay/Manual)
      'PARK',           // Reserved for campaign
      'UNPARK',         // Released after campaign/message completion (refund of reserved)
      'SPEND',          // Permanent deduction (successful message/conversation)
      'REFUND',         // Manual or automated adjustment refund
      'BONUS'           // Promotional credits
    ],
    required: true
  },
  
  // Amount in absolute value (always positive in schema, direction controlled by type)
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Previous and new balance for audit trail
  previousBalance: { type: Number },
  newBalance: { type: Number },
  
  // Reference object for the transaction
  referenceType: {
    type: String,
    enum: ['CAMPAIGN', 'PAYMENT', 'ADJUSTMENT', 'SUBSCRIPTION', 'MESSAGE'],
    required: true
  },
  referenceId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true 
  },
  
  // Status of the transaction
  status: {
    type: String,
    enum: ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'],
    default: 'COMPLETED'
  },
  
  description: { type: String },
  
  // Metadata for Razorpay or provider logs
  metadata: { type: mongoose.Schema.Types.Mixed },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Index for auditing and reporting
WalletTransactionSchema.index({ workspace: 1, createdAt: -1 });
WalletTransactionSchema.index({ workspace: 1, type: 1 });

WalletTransactionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('WalletTransaction', WalletTransactionSchema);
