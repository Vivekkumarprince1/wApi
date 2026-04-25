import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface IInvoiceLineItem {
  type?: string;
  units: number;
  unitPriceCents: number;
  amountCents: number;
  description?: string;
}

export interface IInvoice {
  workspace: Types.ObjectId;
  subscription?: Types.ObjectId;
  usageLedger?: Types.ObjectId;
  
  billingPeriod: string;
  status: 'draft' | 'issued' | 'paid' | 'overdue' | 'void';
  
  lineItems: IInvoiceLineItem[];
  
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  
  issuedAt?: Date;
  dueAt?: Date;
  paidAt?: Date;
  
  providerInvoiceId?: string;
  providerAmountCents?: number;
  providerDeltaCents?: number;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface IInvoiceDocument extends IInvoice, Document {}

const InvoiceSchema = new Schema<IInvoiceDocument>({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', index: true, required: true },
  subscription: { type: Schema.Types.ObjectId, ref: 'Subscription' },
  usageLedger: { type: Schema.Types.ObjectId, ref: 'UsageLedger' },

  billingPeriod: { type: String, index: true },
  status: { type: String, enum: ['draft', 'issued', 'paid', 'overdue', 'void'], default: 'draft' },

  lineItems: [{
    type: { type: String },
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

  invoiceNumber: { type: String, unique: true, sparse: true },
  providerInvoiceId: { type: String },
  providerAmountCents: { type: Number },
  providerDeltaCents: { type: Number }
}, { timestamps: true });

InvoiceSchema.index({ workspace: 1, billingPeriod: 1 });

export const Invoice = (mongoose.models.Invoice as Model<IInvoiceDocument>) || mongoose.model<IInvoiceDocument>('Invoice', InvoiceSchema);
