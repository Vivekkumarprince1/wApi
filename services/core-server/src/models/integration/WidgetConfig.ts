import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface IWidgetConfig {
  workspace: Types.ObjectId;
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
  
  embed: {
    cachedScript?: string;
    cachedAt?: Date;
    cacheVersion: number;
  };
  
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface IWidgetConfigDocument extends IWidgetConfig, Document {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toSafeJSON(): any;
  validateConfig(): { valid: boolean; errors: string[] };
  markActivity(sessions?: number, messages?: number, visitors?: number): Promise<IWidgetConfigDocument>;
  resetMonthlyUsage(): Promise<IWidgetConfigDocument>;
  updateCache(scriptContent: string): Promise<IWidgetConfigDocument>;
  clearCache(): Promise<IWidgetConfigDocument>;
  isPageAllowed(pathname: string): boolean;
  _matchPattern(pathname: string, pattern: string): boolean;
}

const WidgetConfigSchema = new Schema<IWidgetConfigDocument>({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  enabled: { type: Boolean, default: false },
  position: { type: String, enum: ['bottom-right', 'bottom-left', 'top-right', 'top-left', 'full-width-bottom'], default: 'bottom-right' },
  
  color: {
    primary: { type: String, default: '#25D366', validate: { validator: (v: string) => /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(v), message: 'Invalid hex color format' } },
    secondary: { type: String, default: '#1ea652', validate: { validator: (v: string) => /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(v), message: 'Invalid hex color format' } },
    text: { type: String, default: '#ffffff', validate: { validator: (v: string) => /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(v), message: 'Invalid hex color format' } }
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
  },
  
  embed: {
    cachedScript: String,
    cachedAt: Date,
    cacheVersion: { type: Number, default: 1 }
  },
  
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

WidgetConfigSchema.index({ workspace: 1, enabled: 1 });

WidgetConfigSchema.methods.toSafeJSON = function() {
  return {
    id: this._id, enabled: this.enabled, position: this.position, color: this.color,
    greeting: this.greeting, defaultMessage: this.defaultMessage, conversation: this.conversation,
    behavior: this.behavior, attribution: this.attribution, usage: this.usage,
    createdAt: this.createdAt, updatedAt: this.updatedAt
  };
};

WidgetConfigSchema.methods.validateConfig = function() {
  const errors: string[] = [];
  if (!this.greeting?.text || this.greeting.text.trim().length === 0) errors.push('Greeting text is required');
  if (!this.defaultMessage || this.defaultMessage.trim().length === 0) errors.push('Default message is required');
  const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
  if (this.color?.primary && !colorRegex.test(this.color.primary)) errors.push('Invalid primary color format');
  if (this.color?.secondary && !colorRegex.test(this.color.secondary)) errors.push('Invalid secondary color format');
  if (this.color?.text && !colorRegex.test(this.color.text)) errors.push('Invalid text color format');
  if (this.behavior?.delayBeforeShow < 0) errors.push('Delay cannot be negative');
  if (this.conversation?.autoCloseAfter < 0) errors.push('Auto-close timeout cannot be negative');
  return { valid: errors.length === 0, errors };
};

WidgetConfigSchema.methods.markActivity = function(sessions = 0, messages = 0, visitors = 0) {
  this.usage.sessionsThisMonth += sessions;
  this.usage.messagesThisMonth += messages;
  this.usage.uniqueVisitorsThisMonth += visitors;
  this.usage.lastActivityAt = new Date();
  return this.save();
};

WidgetConfigSchema.methods.resetMonthlyUsage = function() {
  this.usage.sessionsThisMonth = 0;
  this.usage.messagesThisMonth = 0;
  this.usage.uniqueVisitorsThisMonth = 0;
  return this.save();
};

WidgetConfigSchema.methods.updateCache = function(scriptContent: string) {
  this.embed.cachedScript = scriptContent;
  this.embed.cachedAt = new Date();
  this.embed.cacheVersion = (this.embed.cacheVersion || 0) + 1;
  return this.save();
};

WidgetConfigSchema.methods.clearCache = function() {
  this.embed.cachedScript = undefined;
  this.embed.cachedAt = undefined;
  return this.save();
};

WidgetConfigSchema.methods.isPageAllowed = function(pathname: string) {
  if (this.behavior?.excludedPages?.some((pattern: string) => this._matchPattern(pathname, pattern))) return false;
  const allowed = this.behavior?.allowedPages || ['*'];
  return allowed.some((pattern: string) => this._matchPattern(pathname, pattern));
};

WidgetConfigSchema.methods._matchPattern = function(pathname: string, pattern: string) {
  if (pattern === '*') return true;
  if (pattern === pathname) return true;
  const regexPattern = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${regexPattern}$`).test(pathname);
};

export const WidgetConfig = (mongoose.models.WidgetConfig as Model<IWidgetConfigDocument>) || mongoose.model<IWidgetConfigDocument>('WidgetConfig', WidgetConfigSchema);
