import { Request, Response } from 'express';
import crypto from 'crypto';
import { config } from '../config';
import { enqueueWebhook } from '../services/messaging/webhook-queue';

export const webhookController = {
  /**
   * WhatsApp Webhook Verification (GET)
   */
  async verifyWhatsApp(req: Request, res: Response) {
    const hubMode = req.query['hub.mode'];
    const hubChallenge = req.query['hub.challenge'];
    const hubVerifyToken = req.query['hub.verify_token'];

    if (hubMode === 'subscribe' && hubChallenge) {
      // Verification MUST require a configured token. Without it, anyone
      // hitting this endpoint could complete Meta's subscription handshake.
      if (!config.whatsappWebhookVerifyToken) {
        console.error('[Webhook:Verify] Refusing handshake: WHATSAPP_WEBHOOK_VERIFY_TOKEN is not configured.');
        return res.status(500).send('Webhook verify token not configured');
      }
      if (hubVerifyToken !== config.whatsappWebhookVerifyToken) {
        return res.status(403).send('Forbidden');
      }
      return res.status(200).send(hubChallenge);
    }

    // Default response for Gupshup or other health pings
    console.log(`[Webhook:Verify] ✓ Responding 200 OK to health ping from ${req.ip} (Query: ${JSON.stringify(req.query)})`);
    return res.status(200).send('OK');
  },

  /**
   * WhatsApp Webhook Receiver (POST)
   */
  async handleWhatsApp(req: Request, res: Response) {
    try {
      const rawBody = (req as any).rawBody || JSON.stringify(req.body);
      
      // Signature validation
      if (!isWebhookSignatureValid(rawBody, req)) {
        console.warn(`[Webhook] ❌ Signature validation failed for payload. rawBody length: ${rawBody?.length || 0}`);
        return res.status(401).send('Invalid signature');
      }
      console.log(`[Webhook] ✓ Signature validated. rawBody length: ${rawBody?.length}`);

      const payload = req.body;
      const rawBodyDigest = crypto.createHash('sha256').update(rawBody).digest('hex').slice(0, 32);
      const deliveryId = resolveDeliveryId(req, payload, rawBodyDigest);

      console.log(`[Webhook] Received payload. DeliveryID: ${deliveryId}`);

      // Enqueue for background processing
      await enqueueWebhook(payload, deliveryId || undefined);

      res.status(200).send('OK');
    } catch (error: any) {
      console.error('[Webhook] Error receiving payload:', error.message);
      res.status(500).send('Failed');
    }
  },

  /**
   * Razorpay Webhook (Forwarded to Billing Service if needed, or handled locally)
   */
  async handleRazorpay(req: Request, res: Response) {
      // In our distributed architecture, Razorpay webhooks are handled by the billing-service.
      // However, if the monolith's endpoint is still targeted, we can proxy it.
      res.status(200).send('OK');
  }
};

// Helper functions (Internal to this file)

const V3_STATUS_TYPES = new Set(['status', 'enqueued', 'accepted', 'sent', 'delivered', 'read', 'seen', 'failed']);

function isWebhookSignatureValid(rawBody: string, req: Request) {
  // Fail closed in production when the shared secret is missing. In
  // development we allow unsigned payloads so local Gupshup/Meta replays
  // still work, but log loudly so it cannot ship by accident.
  if (!config.whatsappWebhookSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[Webhook] Rejecting payload: WHATSAPP_WEBHOOK_SECRET is not configured in production.');
      return false;
    }
    console.warn('[Webhook] WARNING: WHATSAPP_WEBHOOK_SECRET not set; accepting payload (development only).');
    return true;
  }

  const digest = crypto
    .createHmac('sha256', config.whatsappWebhookSecret)
    .update(rawBody)
    .digest('hex');

  const hubSignature = req.headers['x-hub-signature-256'] as string;
  if (hubSignature) {
    return safeCompare(hubSignature, `sha256=${digest}`);
  }

  const gupshupSignature = req.headers['x-gupshup-signature'] as string;
  if (gupshupSignature) {
    // Gupshup historically sends the bare digest, but some integrations
    // prefix it. Try both forms with the timing-safe compare so neither is
    // a leak.
    return safeCompare(gupshupSignature, digest)
      || safeCompare(gupshupSignature, `sha256=${digest}`);
  }

  return false;
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function normalizeIdPart(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : null;
  if (typeof value === 'object') {
    const maybeId = (value as any)?.id || (value as any)?._id;
    if (typeof maybeId === 'string' && maybeId.trim().length) return maybeId.trim();
    if (typeof maybeId === 'number' && Number.isFinite(maybeId)) return String(maybeId);
  }
  return null;
}

function sanitizeDeliveryId(value: string): string {
  return value.replace(/[^a-zA-Z0-9._:-]+/g, '-').slice(0, 180);
}

function getPrimaryStatus(payload: any): any | null {
  // 1. Meta Cloud API format
  const metaStatus = payload?.entry?.[0]?.changes?.[0]?.value?.statuses?.[0];
  if (metaStatus) return metaStatus;

  // 2. Gupshup V3 format
  const directPayload = payload?.payload;
  const directType = String(directPayload?.type || payload?.type || '').toLowerCase();
  const directStatus = String(directPayload?.status || '').toLowerCase();

  if (directPayload && (V3_STATUS_TYPES.has(directType) || V3_STATUS_TYPES.has(directStatus))) {
    return directPayload;
  }

  // 3. Alternate direct format (some BSPs or root-level status)
  if (payload.status && V3_STATUS_TYPES.has(String(payload.status).toLowerCase())) {
    return payload;
  }

  return null;
}

function resolveDeliveryId(req: Request, payload: any, rawBodyDigest: string) {
  const transportDeliveryId = (req.headers['x-delivery-id'] || req.headers['x-request-id']) as string;
  const messageHeaderId = (req.headers['x-gupshup-message-id'] || req.headers['x-message-id']) as string;

  // Status events must dedupe at event-level (status + timestamp), not just message ID.
  const status = getPrimaryStatus(payload);
  if (status) {
    const statusMessageId =
      normalizeIdPart(status.id) ||
      normalizeIdPart(status.messageId) ||
      normalizeIdPart(status.gs_id) ||
      normalizeIdPart(status.gsId) ||
      normalizeIdPart(status.meta_msg_id) ||
      normalizeIdPart(status.metaMsgId) ||
      normalizeIdPart(status.whatsappMessageId) ||
      normalizeIdPart(payload?.payload?.id) ||
      normalizeIdPart(payload?.id) ||
      'unknown';

    const statusNameRaw = status.status || status.type || payload?.payload?.status || payload?.payload?.type || payload?.type;
    const statusName = typeof statusNameRaw === 'string' && statusNameRaw.trim().length
      ? statusNameRaw.trim().toLowerCase()
      : 'status';
    const statusTimestamp =
      normalizeIdPart(status.timestamp) ||
      normalizeIdPart(payload?.payload?.timestamp) ||
      normalizeIdPart(payload?.timestamp) ||
      'na';

    const scope = sanitizeDeliveryId(transportDeliveryId || messageHeaderId || rawBodyDigest);
    // Use both messageId and statusName in the dedupe key to allow sequence of statuses for same message
    return sanitizeDeliveryId(`status:${scope}:${statusMessageId}:${statusName}:${statusTimestamp}`);
  }

  const messageId =
    normalizeIdPart(payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.id) ||
    normalizeIdPart(payload?.payload?.id) ||
    normalizeIdPart(payload?.id);

  if (messageId) {
    const scope = sanitizeDeliveryId(transportDeliveryId || messageHeaderId || rawBodyDigest);
    return sanitizeDeliveryId(`message:${scope}:${messageId}`);
  }

  if (transportDeliveryId || messageHeaderId) {
    return sanitizeDeliveryId(transportDeliveryId || messageHeaderId || rawBodyDigest);
  }

  return sanitizeDeliveryId(`raw:${rawBodyDigest}`);
}
