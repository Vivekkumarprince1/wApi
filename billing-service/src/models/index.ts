import mongoose, { Document, Schema } from 'mongoose';

export interface IWalletDoc extends Document {
  workspaceId: mongoose.Types.ObjectId;
  availableBalance: number;
  parkedBalance: number;
  currency: string;
  isLegacySynced: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const WalletSchema = new Schema<IWalletDoc>({
  workspaceId: { type: Schema.Types.ObjectId, required: true, unique: true, index: true },
  availableBalance: { type: Number, default: 0 },
  parkedBalance: { type: Number, default: 0 },
  currency: { type: String, default: 'INR' },
  isLegacySynced: { type: Boolean, default: false }
}, { timestamps: true });

export const WalletModel = mongoose.model<IWalletDoc>('Wallet', WalletSchema);

export interface IWalletTransactionDoc extends Document {
  workspaceId: mongoose.Types.ObjectId;
  amount: number;
  type: string;
  previousBalance: number;
  newBalance: number;
  description: string;
  referenceType?: string;
  referenceId?: string;
  externalReferenceId?: string;
  status: string;
  createdAt: Date;
}

const WalletTransactionSchema = new Schema<IWalletTransactionDoc>({
  workspaceId: { type: Schema.Types.ObjectId, required: true, index: true },
  amount: { type: Number, required: true },
  type: { type: String, required: true, index: true },
  previousBalance: { type: Number, required: true },
  newBalance: { type: Number, required: true },
  description: { type: String, required: true },
  referenceType: { type: String },
  referenceId: { type: String },
  externalReferenceId: { type: String, index: true, sparse: true },
  status: { type: String, required: true, default: 'COMPLETED' },
}, { timestamps: { createdAt: true, updatedAt: false } });

export const WalletTransactionModel = mongoose.model<IWalletTransactionDoc>('WalletTransaction', WalletTransactionSchema);

// --- Invoice Models ---

export interface IInvoiceLineItem {
  type?: string;
  units: number;
  unitPriceCents: number;
  amountCents: number;
  description?: string;
}

export interface IInvoiceDoc extends Document {
  workspaceId: mongoose.Types.ObjectId;
  subscriptionId?: mongoose.Types.ObjectId;
  billingPeriod: string;
  status: string;
  lineItems: IInvoiceLineItem[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  issuedAt?: Date;
  dueAt?: Date;
  paidAt?: Date;
  invoiceNumber?: string;
  providerInvoiceId?: string;
  providerAmountCents?: number;
  customerDetails?: {
    workspaceName?: string;
    ownerName?: string;
    ownerEmail?: string;
    country?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceSchema = new Schema<IInvoiceDoc>({
  workspaceId: { type: Schema.Types.ObjectId, required: true, index: true },
  subscriptionId: { type: Schema.Types.ObjectId },
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
  currency: { type: String, default: 'INR' },
  issuedAt: { type: Date },
  dueAt: { type: Date },
  paidAt: { type: Date },
  invoiceNumber: { type: String, unique: true, sparse: true },
  providerInvoiceId: { type: String },
  providerAmountCents: { type: Number },
  customerDetails: {
    workspaceName: { type: String, default: '' },
    ownerName: { type: String, default: '' },
    ownerEmail: { type: String, default: '' },
    country: { type: String, default: '' }
  }
}, { timestamps: true });

export const InvoiceModel = mongoose.model<IInvoiceDoc>('Invoice', InvoiceSchema);

export interface IInvoiceSequenceDoc extends Document {
  prefix: string;
  lastNumber: number;
}

const InvoiceSequenceSchema = new Schema<IInvoiceSequenceDoc>({
  prefix: { type: String, required: true, unique: true },
  lastNumber: { type: Number, default: 0 }
}, { timestamps: true });

export const InvoiceSequenceModel = mongoose.model<IInvoiceSequenceDoc>('InvoiceSequence', InvoiceSequenceSchema);

// --- Subscription Model ---

export interface ISubscriptionDoc extends Document {
  workspaceId: mongoose.Types.ObjectId;
  planId: mongoose.Types.ObjectId;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  lastPaymentAt?: Date;
  nextBillingAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionSchema = new Schema<ISubscriptionDoc>({
  workspaceId: { type: Schema.Types.ObjectId, required: true, index: true },
  planId: { type: Schema.Types.ObjectId, required: true },
  status: { type: String, enum: ['trialing', 'active', 'past_due', 'suspended', 'canceled'], default: 'active' },
  currentPeriodStart: { type: Date, required: true },
  currentPeriodEnd: { type: Date, required: true },
  cancelAtPeriodEnd: { type: Boolean, default: false },
  lastPaymentAt: { type: Date },
  nextBillingAt: { type: Date }
}, { timestamps: true });

export const SubscriptionModel = mongoose.model<ISubscriptionDoc>('Subscription', SubscriptionSchema);

// --- Plan Model ---

export interface IPlanDoc extends Document {
  name: string;
  slug: string;
  currency: string;
  monthlyBaseFeeCents: number;
  yearlyBaseFeeCents: number;
  billingIntervalMonths: number;
  isActive: boolean;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PlanSchema = new Schema<IPlanDoc>({
  name: { type: String, required: true },
  slug: { type: String, unique: true, required: true },
  currency: { type: String, default: 'INR' },
  monthlyBaseFeeCents: { type: Number, default: 0 },
  yearlyBaseFeeCents: { type: Number, default: 0 },
  billingIntervalMonths: { type: Number, default: 1 },
  isActive: { type: Boolean, default: true },
  isDefault: { type: Boolean, default: false }
}, { timestamps: true });

export const PlanModel = mongoose.model<IPlanDoc>('Plan', PlanSchema);

// --- Razorpay Order Cache ---
// Stores order metadata locally so verifyRecharge/verifyPlanUpgrade can look up
// the amount without calling the Razorpay API (which can be unreliable in test mode).

export interface IRazorpayOrderDoc extends Document {
  orderId: string;         // Razorpay order ID (e.g. "order_XXXXX")
  workspaceId: string;
  amountPaise: number;
  currency: string;
  type: 'RECHARGE' | 'PLAN_UPGRADE' | 'VERIFICATION';
  planSlug?: string;
  createdAt: Date;
}

const RazorpayOrderSchema = new Schema<IRazorpayOrderDoc>({
  orderId:     { type: String, required: true, unique: true, index: true },
  workspaceId: { type: String, required: true, index: true },
  amountPaise: { type: Number, required: true },
  currency:    { type: String, default: 'INR' },
  type:        { type: String, enum: ['RECHARGE', 'PLAN_UPGRADE', 'VERIFICATION'], required: true },
  planSlug:    { type: String },
}, { timestamps: { createdAt: true, updatedAt: false } });

export const RazorpayOrderModel = mongoose.model<IRazorpayOrderDoc>('RazorpayOrder', RazorpayOrderSchema);

// --- Workspace Minimal (for Plan mapping) ---

export interface IMinimalWorkspaceDoc extends Document {
  planId: mongoose.Types.ObjectId;
  billingStatus: 'trialing' | 'active' | 'past_due' | 'suspended' | 'canceled';
  autoPay: boolean;
  taxId: string;
  createdAt: Date;
  updatedAt: Date;
}

const MinimalWorkspaceSchema = new Schema<IMinimalWorkspaceDoc>({
  planId: { type: Schema.Types.ObjectId, ref: 'Plan' },
  billingStatus: { type: String, enum: ['trialing', 'active', 'past_due', 'suspended', 'canceled'], default: 'trialing' },
  autoPay: { type: Boolean, default: false },
  taxId: { type: String, default: '' },
}, { timestamps: true });


export const WorkspaceModel = mongoose.model<IMinimalWorkspaceDoc>('Workspace', MinimalWorkspaceSchema);

export * from './Order';
export * from './CommerceSettings';
export * from './Product';



