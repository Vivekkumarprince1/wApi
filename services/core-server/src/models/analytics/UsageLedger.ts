import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface IUsageConversations {
  marketing: number;
  utility: number;
  authentication: number;
  service: number;
  businessInitiated: number;
  userInitiated: number;
}

export interface IUsageMessages {
  outbound: number;
  inbound: number;
}

export interface IUsageActivePhones {
  count: number;
  phoneNumberIds: string[];
}

export interface IUsageProviderUsage {
  providerInvoiceId?: string;
  providerAmountCents?: number;
  providerCurrency?: string;
  providerConversations: {
    marketing: number;
    utility: number;
    authentication: number;
    service: number;
  };
}

export interface IUsageReconciliation {
  status: 'pending' | 'matched' | 'mismatch';
  deltaAmountCents: number;
  deltaConversations: number;
  reconciledAt?: Date;
}

export interface IUsageLedger {
  workspace: Types.ObjectId;
  billingPeriod: string;
  periodStart: Date;
  periodEnd: Date;
  
  conversations: IUsageConversations;
  messages: IUsageMessages;
  templateSubmissions: number;
  activePhones: IUsageActivePhones;
  
  providerUsage: IUsageProviderUsage;
  reconciliation: IUsageReconciliation;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface IUsageLedgerDocument extends IUsageLedger, Document {}

const UsageLedgerSchema = new Schema<IUsageLedgerDocument>({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', index: true, required: true },
  billingPeriod: { type: String, index: true },
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

  providerUsage: {
    providerInvoiceId: { type: String },
    providerAmountCents: { type: Number },
    providerCurrency: { type: String },
    providerConversations: {
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

export const UsageLedger = (mongoose.models.UsageLedger as Model<IUsageLedgerDocument>) || mongoose.model<IUsageLedgerDocument>('UsageLedger', UsageLedgerSchema);
