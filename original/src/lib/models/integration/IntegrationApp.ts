import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IIntegrationApp {
  name: string;
  slug: string;
  category?: 'E-commerce' | 'CRM' | 'Payments' | 'Business Tools' | 'Aggregators' | 'Ads';
  authType?: 'OAUTH2' | 'API_KEY' | 'WEBHOOK';
  logoUrl?: string;
  description?: string;
  features: string[];
  
  supportedEvents: Array<{
    eventName: string;
    eventSlug: string;
    schemaVariables: string[];
  }>;
  
  supportedActions: Array<{
    actionName: string;
    actionSlug: string;
  }>;
  
  status: 'ACTIVE' | 'BETA' | 'COMING_SOON';
  planRequired: 'FREE' | 'STARTER' | 'GROWTH' | 'ADVANCED';
  
  createdAt: Date;
  updatedAt: Date;
}

export interface IIntegrationAppDocument extends IIntegrationApp, Document {}

const IntegrationAppSchema = new Schema<IIntegrationAppDocument>({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  category: { type: String, enum: ['E-commerce', 'CRM', 'Payments', 'Business Tools', 'Aggregators', 'Ads'] },
  authType: { type: String, enum: ['OAUTH2', 'API_KEY', 'WEBHOOK'] },
  logoUrl: String,
  description: String,
  features: [String],
  supportedEvents: [{
    eventName: String,
    eventSlug: String,
    schemaVariables: [String]
  }],
  supportedActions: [{
    actionName: String,
    actionSlug: String
  }],
  status: { type: String, enum: ['ACTIVE', 'BETA', 'COMING_SOON'], default: 'ACTIVE' },
  planRequired: { type: String, enum: ['FREE', 'STARTER', 'GROWTH', 'ADVANCED'], default: 'FREE' }
}, { timestamps: true });

export const IntegrationApp = (mongoose.models.IntegrationApp as Model<IIntegrationAppDocument>) || mongoose.model<IIntegrationAppDocument>('IntegrationApp', IntegrationAppSchema);
