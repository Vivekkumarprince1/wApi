const mongoose = require('mongoose');

const PlanSchema = new mongoose.Schema({
  name: { type: String, required: true },          // Free, Starter, Growth
  slug: { type: String, unique: true, required: true },
  currency: { type: String, default: 'USD' },
  monthlyBaseFeeCents: { type: Number, default: 0 },

  // Pass-through billing config (Marketplace/BSP Markups)
  conversationPricing: {
    marketingMarkupPercent: { type: Number, default: 0 },
    utilityMarkupPercent: { type: Number, default: 0 },
    authenticationMarkupPercent: { type: Number, default: 0 },
    serviceMarkupPercent: { type: Number, default: 0 }
  },

  // Absolute pricing for Wallet deductions (Pre-paid model)
  // Prices are stored in paise (100 paise = 1 INR)
  fixedPricePaise: {
    marketing: { type: Number, default: 80 }, // 80 paise default
    utility: { type: Number, default: 40 },   // 40 paise default
    authentication: { type: Number, default: 30 },
    service: { type: Number, default: 0 }     // Service (Session) usually free
  },

  // Platform allowances (not Meta units)
  maxActivePhones: { type: Number, default: 1 },
  templateSubmissionsPerMonth: { type: Number, default: 10 },
  apiRequestsPerMinute: { type: Number, default: 500 },

  // Trial policy
  trialDays: { type: Number, default: 14 },
  trialAllowsSending: { type: Boolean, default: false },

  // Feature Toggles (for Feature Locking)
  // Possible values: 'CRM', 'ANSWERBOT', 'ANALYTICS', 'AUTOMATION', 'BULK_CAMPAIGN', 'WHATSAPP_FORMS'
  features: [{ type: String }],
  
  // Usage Limits
  limits: {
    maxContacts: { type: Number, default: 1000 },
    maxMessagesPerMonth: { type: Number, default: 10000 },
    maxAutomations: { type: Number, default: 5 },
    maxTemplates: { type: Number, default: 20 },
    aiResolutionLimit: { type: Number, default: 0 }
  },

  // Extension for Razorpay SaaS
  razorpayPlanId: { type: String }, // Links to the plan in Razorpay dashboard

  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Plan', PlanSchema);
