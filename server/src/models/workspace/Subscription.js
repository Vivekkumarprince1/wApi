const mongoose = require('mongoose');

const SubscriptionSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', index: true, required: true },
  plan: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true },

  status: {
    type: String,
    enum: ['trialing', 'active', 'past_due', 'suspended', 'canceled'],
    default: 'trialing',
    index: true
  },

  trialStart: { type: Date },
  trialEnd: { type: Date },

  currentPeriodStart: { type: Date, required: true },
  currentPeriodEnd: { type: Date, required: true },
  cancelAtPeriodEnd: { type: Boolean, default: false },

  suspendedAt: { type: Date },
  suspensionReason: { type: String },

  // SaaS billing provider (Razorpay/Stripe/etc.)
  provider: { type: String },
  providerCustomerId: { type: String },
  providerSubscriptionId: { type: String },
  lastPaymentAt: { type: Date },
  nextBillingAt: { type: Date }
}, { timestamps: true });

SubscriptionSchema.index({ workspace: 1, status: 1 });

module.exports = mongoose.model('Subscription', SubscriptionSchema);
