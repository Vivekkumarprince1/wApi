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
      if (config.whatsappWebhookVerifyToken && hubVerifyToken !== config.whatsappWebhookVerifyToken) {
        return res.status(403).send('Forbidden');
      }
      return res.status(200).send(hubChallenge);
    }

    res.json({ ok: true, provider: 'gupshup' });
  },

  /**
   * WhatsApp Webhook Receiver (POST)
   */
  async handleWhatsApp(req: Request, res: Response) {
    try {
      const rawBody = JSON.stringify(req.body);
      
      // Signature validation
      if (!isWebhookSignatureValid(rawBody, req)) {
        return res.status(401).send('Invalid signature');
      }

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
  if (!config.whatsappWebhookSecret) return true;

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
    return safeCompare(gupshupSignature, digest);
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
  const metaStatus = payload?.entry?.[0]?.changes?.[0]?.value?.statuses?.[0];
  if (metaStatus) return metaStatus;

  const directPayload = payload?.payload;
  const directType = String(directPayload?.type || payload?.type || '').toLowerCase();
  const directStatus = String(directPayload?.status || '').toLowerCase();

  if (directPayload && (V3_STATUS_TYPES.has(directType) || V3_STATUS_TYPES.has(directStatus))) {
    return directPayload;
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
