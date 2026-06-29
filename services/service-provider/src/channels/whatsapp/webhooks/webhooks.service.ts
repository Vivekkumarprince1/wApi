import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model } from 'mongoose';
import crypto from 'crypto';
import { config } from '../../../config';
import { ProviderWebhookEvent } from '../../../models/provider-webhook-event.schema';
import { ProviderApp } from '../../../models/provider-app.schema';
import { ProviderTemplateMirror } from '../../../models/provider-template-mirror.schema';
import { ProviderEventProducerService } from '../../../common/provider-event-producer.service';

@Injectable()
export class WebhooksService {
  constructor(
    @InjectModel(ProviderWebhookEvent.name) private readonly eventModel: Model<ProviderWebhookEvent>,
    @InjectModel(ProviderApp.name) private readonly appModel: Model<ProviderApp>,
    @InjectModel(ProviderTemplateMirror.name) private readonly templateModel: Model<ProviderTemplateMirror>,
    private readonly eventProducer: ProviderEventProducerService,
  ) {}

  async receiveGupshup(
    rawBody: string,
    headers: Record<string, string | string[] | undefined>,
    payload: any,
    options: { skipSignatureVerification?: boolean } = {},
  ) {
    if (!options.skipSignatureVerification && !this.isSignatureValid(rawBody, headers)) {
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

    // Save raw webhook event into local database. `new: false` returns the
    // pre-existing doc (or null on first insert), which doubles as an atomic
    // dedup check: providers retry deliveries, and re-streaming a seen event
    // would duplicate chat messages downstream.
    const priorEvent = await this.eventModel.findOneAndUpdate(
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
      { upsert: true, new: false },
    );

    if (priorEvent) {
      console.log(`[WebhooksService] Duplicate webhook delivery ${eventId} ignored.`);
      return { eventId, eventType, status: 'duplicate' };
    }

    // Template status updates (Meta-style message_template_status_update and
    // Gupshup template-event payloads) — keep the template mirror in sync so
    // approval states update without a manual /templates/sync.
    await this.applyTemplateStatusUpdates(payload, workspaceId);

    // --- STREAM PARSED EVENTS TO REDIS PUB/SUB ---

    // 1. Process Status events
    const statuses = this.extractV3Statuses(payload);
    for (const status of statuses) {
      if (['set-callback', 'billing-event', 'account-event', 'template-event'].includes(status.type)) {
        continue;
      }

      const providerIds = this.extractStatusMessageIds(status);
      const providerId = providerIds[0];
      if (!providerId) continue;

      const rawStatus = status.status || status.type || 'unknown';
      const mapped = this.mapMessageStatus(rawStatus);
      if (mapped === 'unknown') continue;

      const parsedEvent = {
        eventId,
        type: 'status_update',
        workspaceId: workspaceId?.toString(),
        messageId: providerId,
        messageIds: providerIds,
        status: mapped,
        timestamp: this.normalizeTimestampSeconds(status.timestamp || status.ts || status.gs_timestamp),
      };

      console.log(`[WebhooksService] Streaming status update to parsed-message-events:`, JSON.stringify(parsedEvent));
      await this.eventProducer.send('parsed-message-events', [
        { key: providerId, value: JSON.stringify(parsedEvent) }
      ]);
    }

    // 2. Process Inbound Messages
    const messages = this.extractV3Messages(payload);
    for (const incoming of messages) {
      const from = this.extractSenderPhone(incoming);
      const messageId = incoming.id;
      const type = incoming.type || 'text';
      const body = this.extractMessageBody(incoming);

      if (!from || !messageId) continue;

      // Purified: contact-service is the sole writer of Contacts.
      // BSP service no longer writes directly to contacts DB.
      let contactId: string | null = null;

      const parsedEvent = {
        eventId,
        workspaceId: workspaceId?.toString(),
        contactId,
        senderPhone: from,
        senderName:
          incoming.contact?.profile?.name ||
          payload?.payload?.sender?.name ||
          incoming.sender?.name ||
          null,
        direction: 'inbound',
        type: type === 'text' ? 'text' : type,
        text: body,
        mediaUrl: this.extractMediaUrl(incoming),
        messageId,
        timestamp: this.normalizeTimestampSeconds(incoming.timestamp || incoming.ts) ?? Math.floor(Date.now() / 1000),
      };

      console.log(`[WebhooksService] Streaming inbound message to parsed-message-events:`, JSON.stringify(parsedEvent));
      await this.eventProducer.send('parsed-message-events', [
        { key: messageId, value: JSON.stringify(parsedEvent) }
      ]);
    }

    return { eventId, eventType, status: 'received' };
  }

  /** Normalize provider timestamps (seconds or milliseconds) to epoch seconds. */
  private normalizeTimestampSeconds(raw: any): number | undefined {
    const numeric = Number(raw);
    if (!numeric || Number.isNaN(numeric)) return undefined;
    return numeric > 1e12 ? Math.floor(numeric / 1000) : Math.floor(numeric);
  }

  /**
   * Webhook-driven template approval updates (monolith parity): Meta sends
   * `message_template_status_update` changes; Gupshup sends `template-event`
   * payloads. Mirror the new status so the UI reflects approvals without a
   * manual sync.
   */
  private async applyTemplateStatusUpdates(payload: any, workspaceId: any) {
    try {
      const updates: Array<{ name: string; status: string; language?: string }> = [];

      const changes = payload?.entry?.[0]?.changes;
      if (Array.isArray(changes)) {
        for (const change of changes) {
          if (change.field === 'message_template_status_update' && change.value?.message_template_name) {
            updates.push({
              name: change.value.message_template_name,
              status: String(change.value.event || '').toUpperCase(),
              language: change.value.message_template_language,
            });
          }
        }
      }

      if (payload?.type === 'template-event' && payload?.payload) {
        const tpl = payload.payload;
        const name = tpl.elementName || tpl.name || tpl.templateName;
        const status = tpl.status || tpl.event;
        if (name && status) {
          updates.push({ name, status: String(status).toUpperCase(), language: tpl.languageCode });
        }
      }

      if (updates.length === 0 || !workspaceId) return;

      for (const update of updates) {
        const filter: any = { workspaceId: workspaceId.toString(), name: update.name };
        if (update.language) filter.language = update.language;
        const result = await this.templateModel.updateMany(filter, { $set: { status: update.status } });
        console.log(
          `[WebhooksService] Template status webhook: ${update.name} -> ${update.status} (${result.modifiedCount} mirrored)`,
        );
      }
    } catch (err: any) {
      console.error('[WebhooksService] Template status update failed:', err.message);
    }
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
    const firstChangeValue = payload?.entry?.[0]?.changes?.[0]?.value;
    const firstStatus = firstChangeValue?.statuses?.[0];
    const statusName = firstStatus?.status || firstStatus?.type;
    const statusProviderId =
      firstStatus?.messageId ||
      firstStatus?.whatsappMessageId ||
      firstStatus?.wamid ||
      firstStatus?.gs_id ||
      firstStatus?.gsId ||
      firstStatus?.id;
    if (!headerId && statusProviderId && statusName) {
      return `status:${String(statusProviderId)}:${String(statusName)}`
        .replace(/[^a-zA-Z0-9._:-]+/g, '-')
        .slice(0, 180);
    }

    const providerMessageId =
      payload?.payload?.id ||
      payload?.payload?.messageId ||
      payload?.payload?.gsId ||
      payload?.payload?.gs_id ||
      payload?.id ||
      payload?.messageId ||
      payload?.gsId ||
      payload?.gs_id ||
      firstChangeValue?.messages?.[0]?.id ||
      firstStatus?.id ||
      firstStatus?.gs_id ||
      firstStatus?.gsId;
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
    const messages: any[] = [];
    if (payload.value?.messages) {
      const contact = payload.value.contacts?.[0];
      messages.push(...payload.value.messages.map((message: any) => ({ ...message, contact })));
    }
    
    if (payload.type === 'message' && payload.payload) {
      messages.push(payload.payload);
    }
  
    const changes = payload?.entry?.[0]?.changes;
    if (changes) {
      for (const change of changes) {
        if (change.value?.messages) {
          const contact = change.value.contacts?.[0];
          messages.push(...change.value.messages.map((message: any) => ({ ...message, contact })));
        }
      }
    }
    return messages;
  }

  private extractStatusMessageIds(status: any): string[] {
    return [
      status.messageId,
      status.whatsappMessageId,
      status.wamid,
      status.gsId,
      status.gs_id,
      status.id,
    ]
      .filter(Boolean)
      .map((id) => String(id));
  }

  private extractSenderPhone(incoming: any): string | null {
    const raw =
      incoming.from ||
      incoming.source ||
      incoming.sender?.phone ||
      incoming.sender?.wa_id ||
      incoming.contact?.wa_id;
    return raw ? String(raw).replace(/\D/g, '') : null;
  }

  private extractMessageBody(incoming: any): string {
    return (
      incoming.text?.body ||
      incoming.payload?.text ||
      incoming.payload?.body ||
      incoming.body ||
      incoming.button?.text ||
      incoming.interactive?.button_reply?.title ||
      incoming.interactive?.list_reply?.title ||
      ''
    );
  }

  private extractMediaUrl(incoming: any): string {
    return (
      incoming.image?.link ||
      incoming.image?.url ||
      incoming.video?.link ||
      incoming.video?.url ||
      incoming.audio?.link ||
      incoming.audio?.url ||
      incoming.document?.link ||
      incoming.document?.url ||
      incoming.mediaUrl ||
      ''
    );
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
