const mongoose = require('mongoose');

const PlanSchema = new mongoose.Schema({
  name: { type: String, required: true },          // Free, Starter, Growth
  slug: { type: String, unique: true, required: true },
  currency: { type: String, default: 'USD' },
  monthlyBaseFeeCents: { type: Number, default: 0 },

  // Pass-through billing config
  conversationPricing: {
    marketingMarkupPercent: { type: Number, default: 0 },
    utilityMarkupPercent: { type: Number, default: 0 },
    authenticationMarkupPercent: { type: Number, default: 0 },
    serviceMarkupPercent: { type: Number, default: 0 }
  },

  // Platform allowances (not Meta units)
  maxActivePhones: { type: Number, default: 1 },
  templateSubmissionsPerMonth: { type: Number, default: 10 },
  apiRequestsPerMinute: { type: Number, default: 500 },

  // Trial policy
  trialDays: { type: Number, default: 14 },
  trialAllowsSending: { type: Boolean, default: false },

  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Plan', PlanSchema);
