import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface ISubscription {
  workspace: Types.ObjectId;
  plan: Types.ObjectId;
  
  status: 'trialing' | 'active' | 'past_due' | 'suspended' | 'canceled';
  
  trialStart?: Date;
  trialEnd?: Date;
  
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  
  suspendedAt?: Date;
  suspensionReason?: string;
  
  provider?: string;
  providerCustomerId?: string;
  providerSubscriptionId?: string;
  lastPaymentAt?: Date;
  nextBillingAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface ISubscriptionDocument extends ISubscription, Document {}

const SubscriptionSchema = new Schema<ISubscriptionDocument>({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', index: true, required: true },
  plan: { type: Schema.Types.ObjectId, ref: 'Plan', required: true },

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

  provider: { type: String },
  providerCustomerId: { type: String },
  providerSubscriptionId: { type: String },
  lastPaymentAt: { type: Date },
  nextBillingAt: { type: Date }
}, { timestamps: true });

SubscriptionSchema.index({ workspace: 1, status: 1 });

export const Subscription = (mongoose.models.Subscription as Model<ISubscriptionDocument>) || mongoose.model<ISubscriptionDocument>('Subscription', SubscriptionSchema);
