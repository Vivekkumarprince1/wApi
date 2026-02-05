const mongoose = require('mongoose');

const InvoiceSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', index: true, required: true },
  subscription: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' },
  usageLedger: { type: mongoose.Schema.Types.ObjectId, ref: 'UsageLedger' },

  billingPeriod: { type: String, index: true }, // YYYY-MM
  status: { type: String, enum: ['draft', 'issued', 'paid', 'overdue', 'void'], default: 'draft' },

  lineItems: [{
    type: { type: String },                 // base_fee, marketing, utility, authentication, service, add_on
    units: { type: Number, default: 0 },
    unitPriceCents: { type: Number, default: 0 },
    amountCents: { type: Number, default: 0 },
    description: { type: String }
  }],

  subtotalCents: { type: Number, default: 0 },
  taxCents: { type: Number, default: 0 },
  totalCents: { type: Number, default: 0 },
  currency: { type: String, default: 'USD' },

  issuedAt: { type: Date },
  dueAt: { type: Date },
  paidAt: { type: Date },

  // Meta pass-through reconciliation (optional)
  metaInvoiceId: { type: String },
  metaAmountCents: { type: Number },
  metaDeltaCents: { type: Number }
}, { timestamps: true });

InvoiceSchema.index({ workspace: 1, billingPeriod: 1 });

module.exports = mongoose.model('Invoice', InvoiceSchema);
