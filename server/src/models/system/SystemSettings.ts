import mongoose, { Schema, Document } from 'mongoose';

export interface ISystemSettings extends Document {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  allowNewSignups: boolean;
  systemNotice: {
    message: string;
    level: 'info' | 'warning' | 'critical';
    active: boolean;
    updatedAt: Date;
  };
  features: {
    aiEnabled: boolean;
    billingEnforced: boolean;
  };
  updatedBy: mongoose.Types.ObjectId;
  updatedAt: Date;
}

const SystemSettingsSchema = new Schema<ISystemSettings>({
  maintenanceMode: { type: Boolean, default: false },
  maintenanceMessage: { type: String, default: 'The system is currently undergoing scheduled maintenance. Please check back soon.' },
  allowNewSignups: { type: Boolean, default: true },
  systemNotice: {
    message: { type: String, default: '' },
    level: { type: String, enum: ['info', 'warning', 'critical'], default: 'info' },
    active: { type: Boolean, default: false },
    updatedAt: { type: Date, default: Date.now }
  },
  features: {
    aiEnabled: { type: Boolean, default: true },
    billingEnforced: { type: Boolean, default: true }
  },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { 
  timestamps: true,
  collection: 'system_settings'
});

// Ensure only one settings document exists
SystemSettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

export const SystemSettings = mongoose.model<ISystemSettings, any>('SystemSettings', SystemSettingsSchema);
