import { Injectable } from '@nestjs/common';
import { ProviderEventProducerService } from '../common/provider-event-producer.service';

const GRAPH_URL = 'https://graph.facebook.com';
const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v18.0';

type ChannelProvider = 'facebook' | 'meta';

@Injectable()
export class ChannelService {
  constructor(
    private readonly eventProducer: ProviderEventProducerService,
  ) { }

  async getFacebookPages(accessToken: string) {
    const response = await fetch(`${GRAPH_URL}/${GRAPH_VERSION}/me/accounts?` + new URLSearchParams({
      access_token: accessToken,
      fields: 'id,name,category,about,website,phone,emails,location,picture',
    }));
    const body = await response.json() as any;
    if (!response.ok) throw new Error(body?.error?.message || 'Failed to fetch Facebook pages');
    return (body.data || []).map((page: any) => ({
      id: page.id,
      name: page.name,
      category: page.category,
      about: page.about,
      website: page.website,
      phone: page.phone,
      emails: page.emails,
      location: page.location,
      picture: page.picture?.data?.url,
    }));
  }

  async sendMessage(provider: ChannelProvider, input: any) {
    const accessToken = input.pageAccessToken || input.accessToken;
    if (!accessToken) throw new Error('accessToken/pageAccessToken is required');

    const endpoint = input.commentId
      ? `${GRAPH_URL}/${GRAPH_VERSION}/${input.commentId}/comments`
      : `${GRAPH_URL}/${GRAPH_VERSION}/me/messages`;

    const message = input.message || { text: input.text };
    const payload = input.commentId
      ? { message: input.text, access_token: accessToken }
      : {
        recipient: { id: input.recipientId },
        ...(input.senderAction ? { sender_action: input.senderAction } : { message }),
        access_token: accessToken,
      };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await response.json() as any;
    if (!response.ok) throw new Error(body?.error?.message || `Failed to send ${provider} message`);
    return this.publishNormalizedOutbound(provider, input, body.message_id || body.id);
  }

  async normalizeInbound(provider: ChannelProvider, rawPayload: any) {
    const eventId =
      rawPayload?.entry?.[0]?.messaging?.[0]?.message?.mid ||
      rawPayload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.id ||
      rawPayload?.id ||
      `${provider}_${Date.now()}`;

    const eventMessage = {
      eventId,
      eventType: 'message.inbound',
      provider: 'meta',
      channel: provider,
      timestamp: new Date().toISOString(),
      rawPayload,
    };

    await this.eventProducer.send('raw-webhook-events', [{
      key: eventId,
      value: JSON.stringify(eventMessage),
    }]);

    return { success: true, eventId };
  }

  private async publishNormalizedOutbound(provider: ChannelProvider, input: any, providerMessageId: string) {
    const eventMessage = {
      eventId: providerMessageId,
      eventType: 'message.status',
      provider: 'meta',
      channel: provider,
      timestamp: new Date().toISOString(),
      rawPayload: {
        direction: 'outbound',
        provider,
        providerMessageId,
        workspaceId: input.workspaceId,
        recipientId: input.recipientId || input.phone,
        text: input.text,
      },
    };

    await this.eventProducer.send('raw-webhook-events', [{
      key: providerMessageId,
      value: JSON.stringify(eventMessage),
    }]);

    return { success: true, providerMessageId };
  }
}
