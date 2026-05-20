import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import crypto from 'crypto';
import { config } from '../config';
import { BspWebhookEvent } from '../models/bsp-webhook-event.schema';

@Injectable()
export class WebhooksService {
  constructor(@InjectModel(BspWebhookEvent.name) private readonly eventModel: Model<BspWebhookEvent>) {}

  async receiveGupshup(rawBody: string, headers: Record<string, string | string[] | undefined>, payload: any) {
    if (!this.isSignatureValid(rawBody, headers)) {
      throw new UnauthorizedException('Invalid Gupshup webhook signature');
    }

    const digest = crypto.createHash('sha256').update(rawBody).digest('hex');
    const eventId = this.resolveEventId(headers, payload, digest);
    const eventType = this.resolveEventType(payload);

    const event = await this.eventModel.findOneAndUpdate(
      { eventId },
      {
        $setOnInsert: {
          eventId,
          provider: 'gupshup',
          appId: payload?.appId || payload?.payload?.appId,
          workspaceId: payload?.workspaceId,
          eventType,
          status: 'received',
          rawPayload: payload,
          normalizedPayload: {
            eventId,
            provider: 'gupshup',
            type: eventType,
            occurredAt: new Date().toISOString(),
            payload,
          },
        },
      },
      { upsert: true, new: true },
    );

    return { eventId: event.eventId, eventType: event.eventType, status: event.status };
  }

  private isSignatureValid(rawBody: string, headers: Record<string, string | string[] | undefined>) {
    if (!config.gupshup.webhookSecret) {
      return config.env !== 'production';
    }

    const digest = crypto.createHmac('sha256', config.gupshup.webhookSecret).update(rawBody).digest('hex');
    const signature = this.headerValue(headers['x-gupshup-signature']) || this.headerValue(headers['x-hub-signature-256']);
    return signature === digest || signature === `sha256=${digest}`;
  }

  private resolveEventId(headers: Record<string, string | string[] | undefined>, payload: any, digest: string) {
    const headerId = this.headerValue(headers['x-delivery-id']) || this.headerValue(headers['x-request-id']);
    const providerMessageId = payload?.payload?.id || payload?.id || payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.id;
    return String(headerId || providerMessageId || digest).replace(/[^a-zA-Z0-9._:-]+/g, '-').slice(0, 180);
  }

  private resolveEventType(payload: any) {
    const type = String(payload?.payload?.type || payload?.type || '').toLowerCase();
    const status = payload?.payload?.status || payload?.entry?.[0]?.changes?.[0]?.value?.statuses?.[0];
    if (status) return 'message.status';
    if (type.includes('billing')) return 'billing.event';
    if (type.includes('template')) return 'template.event';
    if (payload?.payload?.text || payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) return 'message.inbound';
    return type || 'unknown';
  }

  private headerValue(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value;
  }
}
