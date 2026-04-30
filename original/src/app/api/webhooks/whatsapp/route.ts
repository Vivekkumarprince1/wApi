import { NextRequest, NextResponse } from 'next/server';
import { enqueueWebhook } from '@/lib/services/messaging/webhook-queue';
import crypto from 'crypto';
import { config } from '@/lib/config';

const V3_STATUS_TYPES = new Set(['status', 'enqueued', 'accepted', 'sent', 'delivered', 'read', 'seen', 'failed']);

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function isWebhookSignatureValid(rawBody: string, req: NextRequest) {
  if (!config.whatsappWebhookSecret) return true;

  const digest = crypto
    .createHmac('sha256', config.whatsappWebhookSecret)
    .update(rawBody)
    .digest('hex');

  const hubSignature = req.headers.get('x-hub-signature-256');
  if (hubSignature) {
    return safeCompare(hubSignature, `sha256=${digest}`);
  }

  const gupshupSignature = req.headers.get('x-gupshup-signature');
  if (gupshupSignature) {
    return safeCompare(gupshupSignature, digest);
  }

  return false;
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

function resolveDeliveryId(req: NextRequest, payload: any, rawBodyDigest: string) {
  const transportDeliveryId = req.headers.get('x-delivery-id') || req.headers.get('x-request-id');
  const messageHeaderId = req.headers.get('x-gupshup-message-id') || req.headers.get('x-message-id');

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

/**
 * WhatsApp Webhook API Route
 * 
 * Receiver for Gupshup/Meta WhatsApp events.
 * Fast-acknowledgement pattern: Enqueues and returns 200 OK immediately.
 */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const hubMode = searchParams.get('hub.mode');
  const hubChallenge = searchParams.get('hub.challenge');
  const hubVerifyToken = searchParams.get('hub.verify_token');

  // Logic for hub verification if using Meta direct webhooks
  if (hubMode === 'subscribe' && hubChallenge) {
    if (config.whatsappWebhookVerifyToken && hubVerifyToken !== config.whatsappWebhookVerifyToken) {
      return new Response('Forbidden', { status: 403 });
    }
    console.log('[Webhook] Verifying Meta challenge...');
    return new Response(hubChallenge, { status: 200 });
  }

  // Gupshup specific verification (usually just returns 200 OK)
  return NextResponse.json({ ok: true, provider: 'gupshup' });
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    if (!isWebhookSignatureValid(rawBody, req)) {
      return new NextResponse('Invalid signature', { status: 401 });
    }

    const payload = JSON.parse(rawBody || '{}');
  const rawBodyDigest = crypto.createHash('sha256').update(rawBody).digest('hex').slice(0, 32);
  const deliveryId = resolveDeliveryId(req, payload, rawBodyDigest);

    console.log(`[Webhook] Received payload. DeliveryID: ${deliveryId}`);

    // Asynchronously enqueue for background processing
    await enqueueWebhook(payload, deliveryId || undefined);

    // Fast acknowledgement
    return new NextResponse('OK', { status: 200 });
  } catch (error: any) {
    console.error('[Webhook] Error receiving payload:', error.message);
    return new NextResponse('Failed', { status: 500 });
  }
}
