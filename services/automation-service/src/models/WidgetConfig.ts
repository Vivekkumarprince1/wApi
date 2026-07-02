import mongoose, { Document, Schema, Types, Model } from 'mongoose';

export interface IWidgetConfig extends Document {
  workspace: Types.ObjectId;
  widgetId: string;
  phoneNumber: string;
  enabled: boolean;
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'full-width-bottom';
  color: {
    primary: string;
    secondary: string;
    text: string;
  };
  greeting: {
    text: string;
    subtext?: string;
    enabled: boolean;
  };
  defaultMessage: string;
  conversation: {
    showHistory: boolean;
    autoCloseAfter: number;
    maxMessagesBeforeCollection: number;
    collectPhoneNumber: boolean;
    collectEmail: boolean;
    collectName: boolean;
  };
  behavior: {
    showByDefault: boolean;
    buttonLabel: string;
    allowedPages: string[];
    excludedPages: string[];
    delayBeforeShow: number;
  };
  attribution: {
    enabled: boolean;
    customText?: string;
  };
  usage: {
    sessionsThisMonth: number;
    messagesThisMonth: number;
    uniqueVisitorsThisMonth: number;
    lastActivityAt?: Date;
  };
}

const WidgetConfigSchema = new Schema({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  widgetId: { type: String, required: true, index: true, unique: true },
  phoneNumber: { type: String, default: '' },
  enabled: { type: Boolean, default: false },
  position: { type: String, enum: ['bottom-right', 'bottom-left', 'top-right', 'top-left', 'full-width-bottom'], default: 'bottom-right' },
  color: {
    primary: { type: String, default: '#25D366' },
    secondary: { type: String, default: '#1ea652' },
    text: { type: String, default: '#ffffff' }
  },
  greeting: {
    text: { type: String, default: 'Welcome! How can we help?', maxlength: 200 },
    subtext: { type: String, maxlength: 200 },
    enabled: { type: Boolean, default: true }
  },
  defaultMessage: { type: String, default: 'Hello! Thanks for reaching out.', maxlength: 1024 },
  conversation: {
    showHistory: { type: Boolean, default: true },
    autoCloseAfter: { type: Number, default: 0 },
    maxMessagesBeforeCollection: { type: Number, default: 5 },
    collectPhoneNumber: { type: Boolean, default: false },
    collectEmail: { type: Boolean, default: true },
    collectName: { type: Boolean, default: true }
  },
  behavior: {
    showByDefault: { type: Boolean, default: false },
    buttonLabel: { type: String, default: 'Chat with us', maxlength: 50 },
    allowedPages: { type: [String], default: ['*'] },
    excludedPages: { type: [String], default: [] },
    delayBeforeShow: { type: Number, default: 0 }
  },
  attribution: {
    enabled: { type: Boolean, default: true },
    customText: { type: String, maxlength: 100 }
  },
  usage: {
    sessionsThisMonth: { type: Number, default: 0 },
    messagesThisMonth: { type: Number, default: 0 },
    uniqueVisitorsThisMonth: { type: Number, default: 0 },
    lastActivityAt: Date
  }
}, { timestamps: true });

WidgetConfigSchema.index({ workspace: 1 }, { unique: true });

export const WidgetConfig: Model<IWidgetConfig> = (mongoose.models.WidgetConfig as any) || mongoose.model<IWidgetConfig>('WidgetConfig', WidgetConfigSchema);
