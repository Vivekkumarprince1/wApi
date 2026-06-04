import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface ICommercePaymentMethodSettings {
  enabled: boolean;
  [key: string]: any;
}

export interface ICommerceSettings {
  workspaceId: Types.ObjectId;
  enabled: boolean;
  currency: 'INR' | 'USD' | 'EUR' | 'GBP' | 'AUD' | 'CAD' | 'SGD' | 'AED' | 'SAR' | 'KWD' | 'QAR' | 'BHD' | 'OMR';
  taxPercentage: number;
  
  paymentMethods: {
    cashOnDelivery: { enabled: boolean; instructions?: string };
    razorpay: { enabled: boolean; keyId?: string; keySecret?: string; webhookSecret?: string };
    stripe: { enabled: boolean; publicKey?: string; secretKey?: string; webhookSecret?: string };
    paypal: { enabled: boolean; clientId?: string; clientSecret?: string; mode?: 'sandbox' | 'live' };
  };
  
  orderAutoConfirm: boolean;
  
  notifications: {
    notifyAdminOnOrder: boolean;
    notifyCustomerOnOrder: boolean;
    notifyAdminOnPayment: boolean;
    notifyCustomerOnPayment: boolean;
    adminEmails: string[];
  };
  
  shipping: {
    enabled: boolean;
    providers: Array<{ name?: string; apiKey?: string; settings?: any }>;
    flatRate: { enabled: boolean; amount: number };
    freeShippingAbove: { enabled: boolean; amount?: number };
  };
  
  business: {
    storeName?: string;
    logoUrl?: string;
    contactEmail?: string;
    contactPhone?: string;
    address?: string;
    storeDescription?: string;
    policies?: {
      returnPolicy?: string;
      cancellationPolicy?: string;
      shippingPolicy?: string;
      privacyPolicy?: string;
      termsConditions?: string;
    };
  };
  
  checkoutBot: {
    templates: { welcome?: string; catalog?: string; orderStatus?: string; cartRecovery?: string };
    triggers: { welcome: boolean; catalog: boolean; order: boolean; recovery: boolean };
  };

  webhookUrl?: string;
  apiKeysEnabled: boolean;
  
  createdAt: Date;
  updatedAt: Date;
  createdBy?: Types.ObjectId;
  lastModifiedBy?: Types.ObjectId;
}

export interface ICommerceSettingsDocument extends ICommerceSettings, Document {}

const CommerceSettingsSchema = new Schema<ICommerceSettingsDocument>({
  workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, unique: true, index: true },
  enabled: { type: Boolean, default: false },
  currency: { type: String, enum: ['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'AED', 'SAR', 'KWD', 'QAR', 'BHD', 'OMR'], default: 'INR' },
  taxPercentage: { type: Number, default: 0, min: 0, max: 100 },
  
  paymentMethods: {
    cashOnDelivery: { enabled: { type: Boolean, default: true }, instructions: { type: String } },
    razorpay: { enabled: { type: Boolean, default: false }, keyId: { type: String }, keySecret: { type: String }, webhookSecret: { type: String } },
    stripe: { enabled: { type: Boolean, default: false }, publicKey: { type: String }, secretKey: { type: String }, webhookSecret: { type: String } },
    paypal: { enabled: { type: Boolean, default: false }, clientId: { type: String }, clientSecret: { type: String }, mode: { type: String, enum: ['sandbox', 'live'], default: 'sandbox' } }
  },
  
  orderAutoConfirm: { type: Boolean, default: false },
  
  notifications: {
    notifyAdminOnOrder: { type: Boolean, default: true },
    notifyCustomerOnOrder: { type: Boolean, default: true },
    notifyAdminOnPayment: { type: Boolean, default: true },
    notifyCustomerOnPayment: { type: Boolean, default: true },
    adminEmails: [{ type: String, lowercase: true }]
  },
  
  shipping: {
    enabled: { type: Boolean, default: false },
    providers: [{ name: String, apiKey: String, settings: Schema.Types.Mixed }],
    flatRate: { enabled: { type: Boolean, default: false }, amount: { type: Number, default: 0 } },
    freeShippingAbove: { enabled: { type: Boolean, default: false }, amount: { type: Number } }
  },
  
  business: {
    storeName: { type: String },
    logoUrl: { type: String },
    contactEmail: { type: String },
    contactPhone: { type: String },
    address: { type: String },
    storeDescription: { type: String },
    policies: { returnPolicy: String, cancellationPolicy: String, shippingPolicy: String, privacyPolicy: String, termsConditions: String }
  },
  
  checkoutBot: {
    templates: { welcome: String, catalog: String, orderStatus: String, cartRecovery: String },
    triggers: { welcome: { type: Boolean, default: true }, catalog: { type: Boolean, default: true }, order: { type: Boolean, default: true }, recovery: { type: Boolean, default: true } }
  },

  webhookUrl: { type: String },
  apiKeysEnabled: { type: Boolean, default: false },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  lastModifiedBy: { type: Schema.Types.ObjectId, ref: 'User' }
});

CommerceSettingsSchema.pre<ICommerceSettingsDocument>('save', function() {
  this.updatedAt = new Date();
});

export const CommerceSettings = (mongoose.models.CommerceSettings as Model<ICommerceSettingsDocument>) || mongoose.model<ICommerceSettingsDocument>('CommerceSettings', CommerceSettingsSchema);
