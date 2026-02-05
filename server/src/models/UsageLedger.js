const mongoose = require('mongoose');

const UsageLedgerSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', index: true, required: true },
  billingPeriod: { type: String, index: true }, // YYYY-MM
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },

  conversations: {
    marketing: { type: Number, default: 0 },
    utility: { type: Number, default: 0 },
    authentication: { type: Number, default: 0 },
    service: { type: Number, default: 0 },
    businessInitiated: { type: Number, default: 0 },
    userInitiated: { type: Number, default: 0 }
  },

  messages: {
    outbound: { type: Number, default: 0 },
    inbound: { type: Number, default: 0 }
  },

  templateSubmissions: { type: Number, default: 0 },

  activePhones: {
    count: { type: Number, default: 0 },
    phoneNumberIds: [String]
  },

  // Meta reconciliation snapshot
  metaUsage: {
    metaInvoiceId: { type: String },
    metaAmountCents: { type: Number },
    metaCurrency: { type: String },
    metaConversations: {
      marketing: { type: Number, default: 0 },
      utility: { type: Number, default: 0 },
      authentication: { type: Number, default: 0 },
      service: { type: Number, default: 0 }
    }
  },

  reconciliation: {
    status: { type: String, enum: ['pending', 'matched', 'mismatch'], default: 'pending' },
    deltaAmountCents: { type: Number, default: 0 },
    deltaConversations: { type: Number, default: 0 },
    reconciledAt: { type: Date }
  }
}, { timestamps: true });

UsageLedgerSchema.index({ workspace: 1, billingPeriod: 1 }, { unique: true });

module.exports = mongoose.model('UsageLedger', UsageLedgerSchema);
