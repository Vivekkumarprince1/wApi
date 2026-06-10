import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model } from 'mongoose';
import crypto from 'crypto';
import { config } from '../../../config';
import { ProviderWebhookEvent } from '../../../models/provider-webhook-event.schema';
import { ProviderApp } from '../../../models/provider-app.schema';
import { ProviderKafkaProducerService } from '../../../common/provider-kafka-producer.service';

@Injectable()
export class WebhooksService {
  constructor(
    @InjectModel(ProviderWebhookEvent.name) private readonly eventModel: Model<ProviderWebhookEvent>,
    @InjectModel(ProviderApp.name) private readonly appModel: Model<ProviderApp>,
    private readonly kafkaProducer: ProviderKafkaProducerService,
  ) {}

  async receiveGupshup(rawBody: string, headers: Record<string, string | string[] | undefined>, payload: any) {
    if (!this.isSignatureValid(rawBody, headers)) {
      throw new UnauthorizedException('Invalid Gupshup webhook signature');
    }

    const digest = crypto.createHash('sha256').update(rawBody).digest('hex');
    const eventId = this.resolveEventId(headers, payload, digest);
    const eventType = this.resolveEventType(payload);

    // Resolve workspace ID from database ProviderApp mapping
    let workspaceId = payload?.workspaceId;
    const appId = payload?.appId || payload?.gs_app_id || payload?.payload?.appId || payload?.entry?.[0]?.id;
    const phoneNumberId = payload?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id || payload?.phone_number_id || payload?.payload?.phone_number_id;

    if (!workspaceId && (appId || phoneNumberId)) {
      const query: any = {};
      if (appId) {
        query.$or = [
          { appId },
          { gupshupAppId: appId },
          { 'gupshupIdentity.partnerAppId': appId },
        ];
      }
      if (phoneNumberId) {
        if (!query.$or) query.$or = [];
        query.$or.push({ phoneNumberId }, { bspPhoneNumberId: phoneNumberId });
      }

      try {
        const app = await this.appModel.findOne(query).exec();
        if (app) {
          workspaceId = app.workspaceId;
        }
      } catch (err: any) {
        console.error('[WebhooksService] Workspace resolution error:', err.message);
      }
    }

    // Save raw webhook event into local database
    const event = await this.eventModel.findOneAndUpdate(
      { eventId },
      {
        $setOnInsert: {
          eventId,
          provider: 'gupshup',
          appId: appId || payload?.appId || payload?.payload?.appId,
          workspaceId,
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

    // --- STREAM PARSED EVENTS TO KAFKA ---

    // 1. Process Status events
    const statuses = this.extractV3Statuses(payload);
    for (const status of statuses) {
      if (['set-callback', 'billing-event', 'account-event', 'template-event'].includes(status.type)) {
        continue;
      }

      const providerId = status.messageId || status.gsId || status.gs_id || status.id;
      if (!providerId) continue;

      const rawStatus = status.status || status.type || 'unknown';
      const mapped = this.mapMessageStatus(rawStatus);
      if (mapped === 'unknown') continue;

      const parsedEvent = {
        eventId,
        type: 'status_update',
        workspaceId: workspaceId?.toString(),
        messageId: providerId,
        status: mapped,
      };

      console.log(`[WebhooksService] Streaming status update to parsed-message-events:`, JSON.stringify(parsedEvent));
      await this.kafkaProducer.send('parsed-message-events', [
        { key: providerId, value: JSON.stringify(parsedEvent) }
      ]);
    }

    // 2. Process Inbound Messages
    const messages = this.extractV3Messages(payload);
    for (const incoming of messages) {
      const from = incoming.from ? String(incoming.from).replace(/\D/g, '') : null;
      const messageId = incoming.id;
      const type = incoming.type || 'text';
      const body = incoming.text?.body || incoming.body || '';

      if (!from || !messageId) continue;

      // Purified: contact-service is the sole writer of Contacts.
      // BSP service no longer writes directly to contacts DB.
      let contactId: string | null = null;

      const parsedEvent = {
        eventId,
        workspaceId: workspaceId?.toString(),
        contactId,
        senderPhone: from,
        direction: 'inbound',
        type: type === 'text' ? 'text' : type,
        text: body,
        mediaUrl: incoming.image?.link || incoming.video?.link || incoming.audio?.link || incoming.document?.link || '',
        messageId,
      };

      console.log(`[WebhooksService] Streaming inbound message to parsed-message-events:`, JSON.stringify(parsedEvent));
      await this.kafkaProducer.send('parsed-message-events', [
        { key: messageId, value: JSON.stringify(parsedEvent) }
      ]);
    }

    return { eventId: event.eventId, eventType: event.eventType, status: event.status };
  }

  private isSignatureValid(rawBody: string, headers: Record<string, string | string[] | undefined>) {
    if (!config.gupshup.webhookSecret) {
      return config.env !== 'production';
    }

    const digest = crypto.createHmac('sha256', config.gupshup.webhookSecret).update(rawBody).digest('hex');
    const signature = this.headerValue(headers['x-gupshup-signature']) || this.headerValue(headers['x-hub-signature-256']);
    if (!signature || !digest) return false;

    const cleanSignature = signature.startsWith('sha256=') ? signature.slice(7) : signature;

    const cleanSigBuffer = Buffer.from(cleanSignature, 'hex');
    const digestBuffer = Buffer.from(digest, 'hex');

    if (cleanSigBuffer.length !== digestBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(cleanSigBuffer, digestBuffer);
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

  private extractV3Statuses(payload: any) {
    const statuses = [];
    if (payload.value?.statuses) statuses.push(...payload.value.statuses);
    if (Array.isArray(payload?.statuses)) statuses.push(...payload.statuses);
    
    if (payload.type === 'message-event' && payload.payload) {
      statuses.push(payload.payload);
    }
    if (payload.payload?.status && !payload.type) {
       statuses.push(payload.payload);
    }
  
    const changes = payload?.entry?.[0]?.changes;
    if (changes) {
      for (const change of changes) {
        if (change.value?.statuses) statuses.push(...change.value.statuses);
      }
    }
    return statuses;
  }
  
  private extractV3Messages(payload: any) {
    const messages = [];
    if (payload.value?.messages) messages.push(...payload.value.messages);
    
    if (payload.type === 'message' && payload.payload) {
      messages.push(payload.payload);
    }
  
    const changes = payload?.entry?.[0]?.changes;
    if (changes) {
      for (const change of changes) {
        if (change.value?.messages) messages.push(...change.value.messages);
      }
    }
    return messages;
  }

  private mapMessageStatus(rawStatus: string): string {
    const s = String(rawStatus || '').toLowerCase().trim();
    switch (s) {
      case 'enqueued':
      case 'accepted':
      case 'sent':
        return 'sent';
      case 'delivered':
        return 'delivered';
      case 'read':
      case 'seen':
        return 'read';
      case 'failed':
      case 'deleted':
        return 'failed';
      default:
        return 'unknown';
    }
  }
}
