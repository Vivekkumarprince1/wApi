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

// Ensure only one settings document exists. We memoize the *Mongoose
// document* (not a lean object) for a short window so callers that
// mutate + `.save()` it continue to work. /auth/session used to call
// getSettings() twice sequentially per request — the cache erases that
// duplication.
//
// The cached reference is the same document mutated by any
// `settings.x = ...; await settings.save()` callsite, so subsequent
// cached reads observe the mutation immediately. After
// SETTINGS_CACHE_TTL_MS we drop the reference and reload from Mongo.
// Writers that want to guarantee immediate cross-process consistency
// should call `(SystemSettings as any).invalidateCache()` after their
// save (e.g. admin panel save flow).
const SETTINGS_CACHE_TTL_MS = 30_000;
let cachedSettings: any = null;
let cachedAt = 0;
let inflight: Promise<any> | null = null;

SystemSettingsSchema.statics.getSettings = async function () {
  const now = Date.now();
  if (cachedSettings && now - cachedAt < SETTINGS_CACHE_TTL_MS) {
    return cachedSettings;
  }
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      let settings = await this.findOne();
      if (!settings) {
        settings = await this.create({});
      }
      cachedSettings = settings;
      cachedAt = Date.now();
      return settings;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
};

SystemSettingsSchema.statics.invalidateCache = function () {
  cachedSettings = null;
  cachedAt = 0;
};

export const SystemSettings = mongoose.model<ISystemSettings, any>('SystemSettings', SystemSettingsSchema);
