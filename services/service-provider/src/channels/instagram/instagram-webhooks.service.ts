import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import crypto from 'crypto';
import { Model } from 'mongoose';
import { ProviderEventProducerService } from '../../common/provider-event-producer.service';
import { ProviderApp } from '../../models/provider-app.schema';
import { ProviderWebhookEvent } from '../../models/provider-webhook-event.schema';

type ParsedInstagramEvent = {
  eventId: string;
  workspaceId: string;
  senderId: string;
  senderPhone: string;
  senderName?: string | null;
  direction: 'inbound' | 'outbound';
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'reaction';
  text: string;
  mediaUrl?: string;
  messageId: string;
  timestamp: number;
  metadata: Record<string, unknown>;
};

@Injectable()
export class InstagramWebhooksService {
  constructor(
    @InjectModel(ProviderWebhookEvent.name) private readonly eventModel: Model<ProviderWebhookEvent>,
    @InjectModel(ProviderApp.name) private readonly appModel: Model<ProviderApp>,
    private readonly eventProducer: ProviderEventProducerService,
  ) {}

  async receiveInstagram(rawBody: string, headers: Record<string, string | string[] | undefined>, payload: any) {
    const digest = crypto.createHash('sha256').update(rawBody).digest('hex');
    const eventId = this.resolveEventId(headers, payload, digest);
    const workspaceId = payload?.workspaceId || await this.resolveWorkspaceId(payload);
    const eventType = this.resolveEventType(payload);

    const priorEvent = await this.eventModel.findOneAndUpdate(
      { eventId },
      {
        $setOnInsert: {
          eventId,
          provider: 'instagram',
          appId: this.extractInstagramAccountIds(payload)[0],
          workspaceId,
          eventType,
          status: workspaceId ? 'received' : 'ignored',
          rawPayload: payload,
          normalizedPayload: {
            eventId,
            provider: 'instagram',
            type: eventType,
            occurredAt: new Date().toISOString(),
            payload,
          },
        },
      },
      { upsert: true, new: false },
    );

    if (priorEvent) {
      console.log(`[InstagramWebhooksService] Duplicate webhook delivery ${eventId} ignored.`);
      return { eventId, eventType, status: 'duplicate' };
    }

    if (!workspaceId) {
      console.warn(`[InstagramWebhooksService] Workspace not found for Instagram webhook ${eventId}.`);
      return { eventId, eventType, status: 'ignored', reason: 'workspace_not_found' };
    }

    const parsedEvents = this.extractParsedEvents(payload, String(workspaceId), eventId);
    for (const parsedEvent of parsedEvents) {
      await this.eventProducer.send('parsed-message-events', [
        { key: parsedEvent.messageId, value: JSON.stringify(parsedEvent) },
      ]);
    }

    return { eventId, eventType, status: 'received', parsedCount: parsedEvents.length };
  }

  private async resolveWorkspaceId(payload: any): Promise<string | undefined> {
    const ids = this.extractInstagramAccountIds(payload);
    if (!ids.length) return undefined;

    const appIds = ids.flatMap((id) => [id, `instagram:${id}`]);
    const app = await this.appModel.findOne({
      provider: 'instagram',
      $or: [
        { appId: { $in: appIds } },
        { 'providerData.instagramAccountId': { $in: ids } },
        { 'providerData.appScopedUserId': { $in: ids } },
      ],
    }).lean();

    return app?.workspaceId ? String(app.workspaceId) : undefined;
  }

  private extractInstagramAccountIds(payload: any): string[] {
    const ids = new Set<string>();
    const entries = Array.isArray(payload?.entry) ? payload.entry : [];
    for (const entry of entries) {
      if (entry?.id) ids.add(String(entry.id));
      const messaging = Array.isArray(entry?.messaging) ? entry.messaging : [];
      for (const item of messaging) {
        if (item?.recipient?.id) ids.add(String(item.recipient.id));
      }

      const changes = Array.isArray(entry?.changes) ? entry.changes : [];
      for (const change of changes) {
        const value = change?.value || {};
        if (value?.recipient_id) ids.add(String(value.recipient_id));
        if (value?.to?.id) ids.add(String(value.to.id));
      }
    }
    return Array.from(ids);
  }

  private extractParsedEvents(payload: any, workspaceId: string, envelopeId: string): ParsedInstagramEvent[] {
    const parsed: ParsedInstagramEvent[] = [];
    const entries = Array.isArray(payload?.entry) ? payload.entry : [];

    for (const entry of entries) {
      const messaging = Array.isArray(entry?.messaging) ? entry.messaging : [];
      for (const item of messaging) {
        const senderId = item?.sender?.id ? String(item.sender.id) : '';
        const recipientId = item?.recipient?.id ? String(item.recipient.id) : '';
        const timestamp = this.normalizeTimestampSeconds(item?.timestamp) ?? Math.floor(Date.now() / 1000);

        if (item?.message?.is_echo) {
          const echoId = item.message.mid || `${envelopeId}:echo:${timestamp}`;
          parsed.push({
            eventId: envelopeId,
            workspaceId,
            senderId: recipientId || senderId,
            senderPhone: recipientId || senderId,
            direction: 'outbound',
            type: 'text',
            text: item.message.text || '',
            messageId: String(echoId),
            timestamp,
            metadata: {
              provider: 'instagram',
              channel: 'instagram',
              instagram: { triggerType: 'dm', senderId, recipientId, isEcho: true },
            },
          });
          continue;
        }

        if (item?.reaction) {
          const messageId = item.reaction.mid || item.message?.mid || `${envelopeId}:reaction:${senderId}:${timestamp}`;
          parsed.push({
            eventId: envelopeId,
            workspaceId,
            senderId,
            senderPhone: senderId,
            senderName: item.sender?.username || null,
            direction: 'inbound',
            type: 'reaction',
            text: item.reaction.reaction || 'reaction',
            messageId: String(messageId),
            timestamp,
            metadata: {
              provider: 'instagram',
              channel: 'instagram',
              instagram: { triggerType: 'dm', senderId, recipientId, reaction: item.reaction },
            },
          });
          continue;
        }

        if (item?.message || item?.postback) {
          const message = item.message || {};
          const attachment = Array.isArray(message.attachments) ? message.attachments[0] : undefined;
          const messageId = message.mid || item.postback?.mid || `${envelopeId}:message:${senderId}:${timestamp}`;
          const attachmentType = this.mapAttachmentType(attachment?.type);
          parsed.push({
            eventId: envelopeId,
            workspaceId,
            senderId,
            senderPhone: senderId,
            senderName: item.sender?.username || null,
            direction: 'inbound',
            type: attachmentType || 'text',
            text: message.text || item.postback?.title || item.postback?.payload || '',
            mediaUrl: attachment?.payload?.url,
            messageId: String(messageId),
            timestamp,
            metadata: {
              provider: 'instagram',
              channel: 'instagram',
              instagram: {
                triggerType: this.isStoryReply(item) ? 'story_reply' : 'dm',
                senderId,
                recipientId,
                referral: item.referral,
                replyTo: item.message?.reply_to,
              },
            },
          });
        }
      }

      const changes = Array.isArray(entry?.changes) ? entry.changes : [];
      for (const change of changes) {
        const value = change?.value || {};
        const field = String(change?.field || '').toLowerCase();
        if (!['comments', 'mentions', 'live_comments'].includes(field)) continue;

        const senderId = value?.from?.id ? String(value.from.id) : '';
        if (!senderId) continue;

        const triggerType = field === 'mentions' ? 'mention' : 'comment';
        const messageId = value.id || value.comment_id || `${envelopeId}:${field}:${senderId}`;
        parsed.push({
          eventId: envelopeId,
          workspaceId,
          senderId,
          senderPhone: senderId,
          senderName: value?.from?.username || null,
          direction: 'inbound',
          type: 'text',
          text: value.text || value.caption || '',
          messageId: String(messageId),
          timestamp: this.normalizeTimestampSeconds(value.created_time || value.timestamp) ?? Math.floor(Date.now() / 1000),
          metadata: {
            provider: 'instagram',
            channel: 'instagram',
            instagram: {
              triggerType,
              senderId,
              username: value?.from?.username,
              commentId: value.id || value.comment_id,
              mediaId: value.media_id || value.media?.id,
              parentId: value.parent_id,
              field,
            },
          },
        });
      }
    }

    return parsed.filter((event) => event.senderId && event.messageId);
  }

  private isStoryReply(item: any) {
    return Boolean(item?.message?.reply_to?.story || item?.referral?.source === 'STORY' || item?.referral?.type === 'OPEN_THREAD');
  }

  private mapAttachmentType(rawType: unknown): ParsedInstagramEvent['type'] | undefined {
    const type = String(rawType || '').toLowerCase();
    if (type === 'image' || type === 'video' || type === 'audio') return type;
    if (type === 'file' || type === 'fallback') return 'document';
    return undefined;
  }

  private resolveEventType(payload: any) {
    const entries = Array.isArray(payload?.entry) ? payload.entry : [];
    if (entries.some((entry: any) => Array.isArray(entry?.messaging) && entry.messaging.length > 0)) {
      return 'message.inbound';
    }
    const firstField = entries.flatMap((entry: any) => entry?.changes || [])[0]?.field;
    return firstField ? `instagram.${firstField}` : 'instagram.webhook';
  }

  private resolveEventId(headers: Record<string, string | string[] | undefined>, payload: any, digest: string) {
    const headerId = this.headerValue(headers['x-delivery-id']) || this.headerValue(headers['x-request-id']);
    if (headerId) return String(headerId).slice(0, 180);

    const entries = Array.isArray(payload?.entry) ? payload.entry : [];
    for (const entry of entries) {
      const firstMessaging = Array.isArray(entry?.messaging) ? entry.messaging[0] : undefined;
      const id =
        firstMessaging?.message?.mid ||
        firstMessaging?.reaction?.mid ||
        firstMessaging?.postback?.mid ||
        firstMessaging?.read?.mid ||
        firstMessaging?.delivery?.mids?.[0];
      if (id) return String(id).replace(/[^a-zA-Z0-9._:-]+/g, '-').slice(0, 180);

      const firstChange = Array.isArray(entry?.changes) ? entry.changes[0] : undefined;
      const changeId = firstChange?.value?.id || firstChange?.value?.comment_id;
      if (changeId) return String(changeId).replace(/[^a-zA-Z0-9._:-]+/g, '-').slice(0, 180);
    }

    return digest.slice(0, 180);
  }

  private normalizeTimestampSeconds(raw: any): number | undefined {
    const numeric = Number(raw);
    if (!numeric || Number.isNaN(numeric)) return undefined;
    return numeric > 1e12 ? Math.floor(numeric / 1000) : Math.floor(numeric);
  }

  private headerValue(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value;
  }
}
