import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export type WalletTransactionType = 'RECHARGE' | 'PARK' | 'UNPARK' | 'SPEND' | 'REFUND' | 'BONUS' | 'SUBSCRIPTION_PURCHASE';
export type WalletReferenceType = 'CAMPAIGN' | 'PAYMENT' | 'ADJUSTMENT' | 'SUBSCRIPTION' | 'MESSAGE' | 'AUTOMATION_OR_WAP_DIRECT';
export type WalletTransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface IWalletTransaction {
  workspace: Types.ObjectId;
  type: WalletTransactionType;
  amount: number;
  
  previousBalance?: number;
  newBalance?: number;
  
  referenceType: WalletReferenceType;
  referenceId?: Types.ObjectId;
  
  status: WalletTransactionStatus;
  description?: string;
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: any;
  
  /**
   * For security: ensure we never process the same external payment ID twice
   * Stores values like pay_XXXXXXXXXXXX from Razorpay
   */
  externalReferenceId?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface IWalletTransactionDocument extends IWalletTransaction, Document {}

const WalletTransactionSchema = new Schema<IWalletTransactionDocument>({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', index: true, required: true },
  type: {
    type: String,
    enum: ['RECHARGE', 'PARK', 'UNPARK', 'SPEND', 'REFUND', 'BONUS', 'SUBSCRIPTION_PURCHASE'],
    required: true
  },
  
  amount: { type: Number, required: true, min: 0 },
  
  previousBalance: { type: Number },
  newBalance: { type: Number },
  
  referenceType: {
    type: String,
    enum: ['CAMPAIGN', 'PAYMENT', 'ADJUSTMENT', 'SUBSCRIPTION', 'MESSAGE', 'AUTOMATION_OR_WAP_DIRECT'],
    required: true
  },
  referenceId: { type: Schema.Types.ObjectId, required: false },
  
  status: {
    type: String,
    enum: ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'],
    default: 'COMPLETED'
  },
  
  description: { type: String },
  metadata: { type: Schema.Types.Mixed },
  externalReferenceId: { type: String, index: { unique: true, sparse: true } },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

WalletTransactionSchema.index({ workspace: 1, createdAt: -1 });
WalletTransactionSchema.index({ workspace: 1, type: 1 });

WalletTransactionSchema.pre<IWalletTransactionDocument>('save', function () {
  this.updatedAt = new Date();
});

// Force-update enum validation for referenceType in dev mode (Sticky Model Workaround)
if (mongoose.models.WalletTransaction && mongoose.models.WalletTransaction.schema.path('referenceType')) {
  const path = mongoose.models.WalletTransaction.schema.path('referenceType') as any;
  const newEnums = ['CAMPAIGN', 'PAYMENT', 'ADJUSTMENT', 'SUBSCRIPTION', 'MESSAGE', 'AUTOMATION_OR_WAP_DIRECT'];
  path.options.enum = newEnums;
  if (path.enumValues) path.enumValues = newEnums;
  if (path.validators) {
    path.validators = path.validators.map((v: any) => {
        if (v.type === 'enum' || v.message === '`{VALUE}` is not a valid enum value for path `{PATH}`.') {
            return { ...v, enum: newEnums };
        }
        return v;
    });
  }
}

export const WalletTransaction = (mongoose.models.WalletTransaction as Model<IWalletTransactionDocument>) || mongoose.model<IWalletTransactionDocument>('WalletTransaction', WalletTransactionSchema);

