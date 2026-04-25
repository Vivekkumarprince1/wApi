import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface IWebhookLog {
  source: string;
  workspace?: Types.ObjectId;
  phoneNumberId?: string;
  bspRouted: boolean;
  deliveryId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
  verified: boolean;
  signatureHeader?: string;
  processed: boolean;
  processedAt?: Date;
  error?: string;
  eventType?: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface IWebhookLogDocument extends IWebhookLog, Document {}

function maskPhone(value: any) {
  const digits = (value || '').toString();
  if (digits.length <= 4) return '****';
  return `****${digits.slice(-4)}`;
}

function redactWebhookPayload(payload: any) {
  try {
    const cloned = JSON.parse(JSON.stringify(payload || {}));
    if (!cloned?.entry) return cloned;
    for (const entry of cloned.entry) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        if (Array.isArray(value.contacts)) {
          value.contacts = value.contacts.map((c: any) => ({ ...c, wa_id: c.wa_id ? maskPhone(c.wa_id) : c.wa_id, profile: c.profile ? { name: '[REDACTED]' } : c.profile }));
        }
        if (Array.isArray(value.messages)) {
          value.messages = value.messages.map((m: any) => ({ ...m, from: m.from ? maskPhone(m.from) : m.from, text: m.text ? { body: '[REDACTED]' } : m.text, button: m.button ? { text: '[REDACTED]' } : m.button, interactive: m.interactive ? { ...m.interactive, body: '[REDACTED]' } : m.interactive }));
        }
        if (Array.isArray(value.statuses)) {
          value.statuses = value.statuses.map((s: any) => ({ ...s, recipient_id: s.recipient_id ? maskPhone(s.recipient_id) : s.recipient_id }));
        }
        change.value = value;
      }
    }
    return cloned;
  } catch (err: any) {
    console.error('[WebhookLog] Redaction failed:', err.message);
    return { error: 'redaction_failed' };
  }
}

const WebhookLogSchema = new Schema<IWebhookLogDocument>({
  source: { type: String, default: 'meta' },
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace' },
  phoneNumberId: { type: String },
  bspRouted: { type: Boolean, default: false },
  deliveryId: { type: String },
  payload: { type: Object, required: true },
  verified: { type: Boolean, default: false },
  signatureHeader: { type: String },
  processed: { type: Boolean, default: false },
  processedAt: { type: Date },
  error: { type: String },
  eventType: { type: String },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
  createdAt: { type: Date, default: Date.now }
});

WebhookLogSchema.index({ workspace: 1, createdAt: -1 });
WebhookLogSchema.index({ processed: 1, createdAt: -1 });
WebhookLogSchema.index({ eventType: 1, createdAt: -1 });
WebhookLogSchema.index({ deliveryId: 1, eventType: 1 });
WebhookLogSchema.index({ phoneNumberId: 1, createdAt: -1 });
WebhookLogSchema.index({ bspRouted: 1, createdAt: -1 });
WebhookLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

WebhookLogSchema.pre<IWebhookLogDocument>('save', function() {
  if (this.payload) {
    this.payload = redactWebhookPayload(this.payload);
  }
  
});

export const WebhookLog = (mongoose.models.WebhookLog as Model<IWebhookLogDocument>) || mongoose.model<IWebhookLogDocument>('WebhookLog', WebhookLogSchema);
