const mongoose = require('mongoose');

function maskPhone(value) {
  const digits = (value || '').toString();
  if (digits.length <= 4) return '****';
  return `****${digits.slice(-4)}`;
}

function redactWebhookPayload(payload) {
  try {
    const cloned = JSON.parse(JSON.stringify(payload || {}));
    if (!cloned?.entry) return cloned;

    for (const entry of cloned.entry) {
      for (const change of entry.changes || []) {
        const value = change.value || {};

        if (Array.isArray(value.contacts)) {
          value.contacts = value.contacts.map(c => ({
            ...c,
            wa_id: c.wa_id ? maskPhone(c.wa_id) : c.wa_id,
            profile: c.profile ? { name: '[REDACTED]' } : c.profile
          }));
        }

        if (Array.isArray(value.messages)) {
          value.messages = value.messages.map(m => ({
            ...m,
            from: m.from ? maskPhone(m.from) : m.from,
            text: m.text ? { body: '[REDACTED]' } : m.text,
            button: m.button ? { text: '[REDACTED]' } : m.button,
            interactive: m.interactive ? { ...m.interactive, body: '[REDACTED]' } : m.interactive
          }));
        }

        if (Array.isArray(value.statuses)) {
          value.statuses = value.statuses.map(s => ({
            ...s,
            recipient_id: s.recipient_id ? maskPhone(s.recipient_id) : s.recipient_id
          }));
        }

        change.value = value;
      }
    }

    return cloned;
  } catch (err) {
    console.error('[WebhookLog] Redaction failed:', err.message);
    return { error: 'redaction_failed' };
  }
}

const WebhookLogSchema = new mongoose.Schema({
  // Source
  source: { type: String, default: 'meta' },
  
  // Workspace mapped from phone_number_id
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace' },
  
  // ═══════════════════════════════════════════════════════════════════
  // BSP MULTI-TENANT TRACKING
  // ═══════════════════════════════════════════════════════════════════
  
  // The phone_number_id used for routing (BSP model)
  phoneNumberId: { type: String },
  
  // Whether BSP routing was successful
  bspRouted: { type: Boolean, default: false },
  
  // ✅ Idempotency: delivery ID from Meta
  deliveryId: { type: String }, // x-hub-delivery or entry.id
  
  // Raw payload
  payload: { type: Object, required: true },
  
  // Verification
  verified: { type: Boolean, default: false },
  signatureHeader: { type: String },
  
  // Processing status
  processed: { type: Boolean, default: false },
  processedAt: { type: Date },
  
  // Error tracking
  error: { type: String },
  
  // Event type extracted from payload
  eventType: { type: String }, // e.g., 'message', 'status', 'template_status', 'account_update'

  // Retention TTL (Meta compliance)
  // WHY: Limit PII exposure in webhook logs
  expiresAt: { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
  
  createdAt: { type: Date, default: Date.now }
});

// Index for querying
WebhookLogSchema.index({ workspace: 1, createdAt: -1 });
WebhookLogSchema.index({ processed: 1, createdAt: -1 });
WebhookLogSchema.index({ eventType: 1, createdAt: -1 });
// ✅ Index for idempotency check
WebhookLogSchema.index({ deliveryId: 1, eventType: 1 });
// BSP: Index for phone_number_id routing analytics
WebhookLogSchema.index({ phoneNumberId: 1, createdAt: -1 });
WebhookLogSchema.index({ bspRouted: 1, createdAt: -1 });
// TTL index for retention
WebhookLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

WebhookLogSchema.pre('save', function(next) {
  if (this.payload) {
    this.payload = redactWebhookPayload(this.payload);
  }
  next();
});

module.exports = mongoose.model('WebhookLog', WebhookLogSchema);
