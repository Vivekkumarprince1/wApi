import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IPlan {
  name: string;
  slug: string;
  currency: string;
  monthlyBaseFeeCents: number;
  yearlyBaseFeeCents: number;
  billingIntervalMonths: number; // e.g. 1 for monthly, 3 for quarterly
  
  conversationPricing: {
    marketingMarkupPercent: number;
    utilityMarkupPercent: number;
    authenticationMarkupPercent: number;
    serviceMarkupPercent: number;
  };
  
  fixedPricePaise: {
    marketing: number;
    utility: number;
    authentication: number;
    service: number;
  };
  
  maxActivePhones: number;
  templateSubmissionsPerMonth: number;
  apiRequestsPerMinute: number;
  
  trialDays: number;
  trialAllowsSending: boolean;
  
  features: string[];
  
  limits: {
    maxContacts: number;
    maxMessagesPerMonth: number;
    maxAutomations: number;
    maxTemplates: number;
    aiResolutionLimit: number;
  };
  
  razorpayPlanId?: string;
  isActive: boolean;
  isDefault: boolean;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface IPlanDocument extends IPlan, Document {}

const PlanSchema = new Schema<IPlanDocument>({
  name: { type: String, required: true },
  slug: { type: String, unique: true, required: true },
  currency: { type: String, default: 'INR' },
  monthlyBaseFeeCents: { type: Number, default: 0 },
  yearlyBaseFeeCents: { type: Number, default: 0 },
  billingIntervalMonths: { type: Number, default: 1 },

  conversationPricing: {
    marketingMarkupPercent: { type: Number, default: 0 },
    utilityMarkupPercent: { type: Number, default: 0 },
    authenticationMarkupPercent: { type: Number, default: 0 },
    serviceMarkupPercent: { type: Number, default: 0 }
  },

  fixedPricePaise: {
    marketing: { type: Number, default: 80 },
    utility: { type: Number, default: 40 },
    authentication: { type: Number, default: 30 },
    service: { type: Number, default: 0 }
  },

  maxActivePhones: { type: Number, default: 1 },
  templateSubmissionsPerMonth: { type: Number, default: 10 },
  apiRequestsPerMinute: { type: Number, default: 500 },

  trialDays: { type: Number, default: 0 },
  trialAllowsSending: { type: Boolean, default: false },

  features: [{ type: String }],
  
  limits: {
    maxContacts: { type: Number, default: 1000 },
    maxMessagesPerMonth: { type: Number, default: 5000 },
    maxAutomations: { type: Number, default: 2 },
    maxTemplates: { type: Number, default: 10 },
    aiResolutionLimit: { type: Number, default: 0 }
  },

  razorpayPlanId: { type: String },
  isActive: { type: Boolean, default: true },
  isDefault: { type: Boolean, default: false }
}, { timestamps: true });

export const Plan = (mongoose.models.Plan as Model<IPlanDocument>) || mongoose.model<IPlanDocument>('Plan', PlanSchema);
