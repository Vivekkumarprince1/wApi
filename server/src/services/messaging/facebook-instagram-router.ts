/**
 * Enhanced Facebook/Instagram Messaging Router
 * Handles proper channel awareness and conversation grouping for Meta platforms
 */

import axios, { AxiosInstance } from 'axios';
import { Conversation, Contact } from '../../models';

type MetaChannel = 'facebook_messenger' | 'instagram_dm' | 'instagram_comment' | 'facebook_comment';

interface MetaMessage {
  from: { id: string; name: string };
  to: { id: string };
  text?: string;
  attachment?: { type: string; url: string };
  timestamp: number;
  stanza_id?: string;
}

interface RouteContext {
  workspaceId: string;
  channel: MetaChannel;
  senderId: string;
  senderName: string;
  recipientId: string;
  pageId: string;
}

export class FacebookInstagramRouter {
  private graphApi: AxiosInstance;
  private static readonly GRAPH_URL = 'https://graph.facebook.com';
  private static readonly VERSION = 'v18.0';

  constructor() {
    this.graphApi = axios.create({
      baseURL: `${FacebookInstagramRouter.GRAPH_URL}/${FacebookInstagramRouter.VERSION}`,
      timeout: 10000,
    });
  }

  /**
   * Route incoming message to correct conversation
   * Groups messages by sender+page+channel combination
   */
  async routeIncomingMessage(
    context: RouteContext,
    message: MetaMessage
  ): Promise<{
    conversationId: string;
    conversationCreated: boolean;
  }> {
    try {
      // Build conversation query based on channel
      const conversationQuery = this.buildConversationQuery(context);

      // Find or create conversation
      let conversation = await Conversation.findOne(conversationQuery);
      let conversationCreated = false;

      if (!conversation) {
        // Find or create contact
        let contact = await Contact.findOne({
          workspaceId: context.workspaceId,
          externalId: context.senderId,
        });

        if (!contact) {
          contact = await Contact.create({
            workspaceId: context.workspaceId,
            name: context.senderName || 'Unknown',
            externalId: context.senderId,
            channel: context.channel,
            source: 'meta',
            metadata: {
              metaPageId: context.pageId,
              metaUserId: context.senderId,
            },
          });
        }

        // Create conversation
        conversation = await Conversation.create({
          workspaceId: context.workspaceId,
          contact: contact._id,
          channel: this.mapChannelToType(context.channel),
          subChannel: context.channel,
          isOpen: true,
          status: 'open',
          metadata: {
            metaPageId: context.pageId,
            metaUserId: context.senderId,
            metaChannel: context.channel,
          },
          lastActivityAt: new Date(),
        });

        conversationCreated = true;

        console.log(
          `[Meta Router] Created new ${context.channel} conversation: ${conversation._id}`
        );
      }

      // Update last activity
      conversation.lastActivityAt = new Date();
      await conversation.save();

      return {
        conversationId: conversation._id.toString(),
        conversationCreated,
      };
    } catch (error) {
      console.error('[Meta Router] Error routing message:', error);
      throw error;
    }
  }

  /**
   * Send message through appropriate Meta channel
   */
  async sendMessage(
    context: RouteContext,
    text: string,
    pageAccessToken: string,
    attachment?: { type: string; url: string }
  ): Promise<string> {
    try {
      let messageId: string;

      switch (context.channel) {
        case 'facebook_messenger':
        case 'instagram_dm':
          messageId = await this.sendDirectMessage(
            context.recipientId,
            text,
            pageAccessToken,
            attachment
          );
          break;

        case 'facebook_comment':
        case 'instagram_comment':
          messageId = await this.replyToComment(
            context.recipientId,
            text,
            pageAccessToken
          );
          break;

        default:
          throw new Error(`Unknown channel: ${context.channel}`);
      }

      return messageId;
    } catch (error) {
      console.error('[Meta Router] Error sending message:', error);
      throw error;
    }
  }

  /**
   * Send direct message (Messenger or DM)
   */
  private async sendDirectMessage(
    recipientId: string,
    text: string,
    pageAccessToken: string,
    attachment?: { type: string; url: string }
  ): Promise<string> {
    try {
      const messageObject: any = {
        recipient: { id: recipientId },
        message: {},
      };

      if (attachment) {
        messageObject.message.attachment = {
          type: attachment.type,
          payload: { url: attachment.url },
        };
      } else {
        messageObject.message.text = text;
      }

      const response = await this.graphApi.post('/me/messages', messageObject, {
        params: { access_token: pageAccessToken },
      });

      console.log('[Meta Router] Message sent:', response.data.message_id);
      return response.data.message_id;
    } catch (error: any) {
      const errorMsg =
        error.response?.data?.error?.message || 'Failed to send message';
      throw new Error(errorMsg);
    }
  }

  /**
   * Reply to comment (Facebook/Instagram post comment)
   */
  private async replyToComment(
    commentId: string,
    text: string,
    pageAccessToken: string
  ): Promise<string> {
    try {
      const response = await this.graphApi.post(
        `/${commentId}/comments`,
        { message: text },
        { params: { access_token: pageAccessToken } }
      );

      console.log('[Meta Router] Comment reply created:', response.data.id);
      return response.data.id;
    } catch (error: any) {
      const errorMsg =
        error.response?.data?.error?.message || 'Failed to reply to comment';
      throw new Error(errorMsg);
    }
  }

  /**
   * Detect channel from Meta webhook payload
   */
  static detectChannel(webhookPayload: any): MetaChannel | null {
    const { messaging, entry, changes } = webhookPayload;

    // Messenger/DM detection
    if (messaging?.[0]?.message) {
      const item = messaging[0];

      if (item.sender?.id && item.recipient?.id) {
        // Could be messenger or Instagram DM
        // Instagram DMs have different format
        if (webhookPayload.object === 'instagram') {
          return 'instagram_dm';
        }
        return 'facebook_messenger';
      }
    }

    // Comment detection (Feed comments)
    if (changes?.[0]?.field === 'feed') {
      const object = webhookPayload.object;
      if (object === 'instagram') {
        return 'instagram_comment';
      } else if (object === 'page') {
        return 'facebook_comment';
      }
    }

    return null;
  }

  /**
   * Build conversation query based on channel
   */
  private buildConversationQuery(context: RouteContext) {
    const baseQuery = {
      workspaceId: context.workspaceId,
    };

    // Key: group conversations by sender + channel + page
    // This prevents cross-channel conversation mixing
    switch (context.channel) {
      case 'facebook_messenger':
      case 'instagram_dm':
        // DMs: one conversation per user per page
        return {
          ...baseQuery,
          metadata: {
            metaPageId: context.pageId,
            metaUserId: context.senderId,
            metaChannel: context.channel,
          },
          channel: 'direct_message',
        };

      case 'facebook_comment':
      case 'instagram_comment':
        // Comments: one conversation per post (recipientId is post ID)
        return {
          ...baseQuery,
          metadata: {
            metaPageId: context.pageId,
            metaPostId: context.recipientId,
            metaChannel: context.channel,
          },
          channel: 'social_comment',
        };

      default:
        return baseQuery;
    }
  }

  /**
   * Map Meta channel to internal conversation type
   */
  private mapChannelToType(channel: MetaChannel): string {
    switch (channel) {
      case 'facebook_messenger':
      case 'instagram_dm':
        return 'direct_message';
      case 'facebook_comment':
      case 'instagram_comment':
        return 'social_comment';
      default:
        return 'other';
    }
  }

  /**
   * Get all connected Instagram/Facebook accounts for workspace
   */
  async getConnectedAccounts(workspaceId: string): Promise<any[]> {
    try {
      // This should fetch from workspace integrations
      // Implementation depends on how you store integration settings
      return [];
    } catch (error) {
      console.error('[Meta Router] Error fetching connected accounts:', error);
      throw error;
    }
  }

  /**
   * Validate webhook signature
   */
  static validateWebhookSignature(
    body: string,
    signature: string,
    appSecret: string
  ): boolean {
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', appSecret)
      .update(body)
      .digest('hex');

    return expectedSignature === signature;
  }

  /**
   * Parse Instagram webhook payload
   */
  static parseInstagramWebhook(payload: any) {
    const entry = payload.entry?.[0];
    const messaging = entry?.messaging?.[0];

    if (!messaging) return null;

    return {
      senderId: messaging.sender?.id,
      recipientId: messaging.recipient?.id,
      text: messaging.message?.text,
      timestamp: messaging.timestamp,
      messageId: messaging.message?.mid,
    };
  }

  /**
   * Parse Facebook webhook payload
   */
  static parseFacebookWebhook(payload: any) {
    const entry = payload.entry?.[0];
    const messaging = entry?.messaging?.[0];
    const changes = entry?.changes?.[0];

    // Handle DMs
    if (messaging?.message) {
      return {
        type: 'message',
        senderId: messaging.sender?.id,
        recipientId: messaging.recipient?.id,
        text: messaging.message?.text,
        timestamp: messaging.timestamp,
        messageId: messaging.message?.mid,
      };
    }

    // Handle comments
    if (changes?.field === 'feed' && changes.value?.comment_id) {
      return {
        type: 'comment',
        commentId: changes.value.comment_id,
        postId: changes.value.post_id,
        senderId: changes.value.from?.id,
        text: changes.value.message,
        timestamp: changes.value.created_time,
      };
    }

    return null;
  }
}

export default FacebookInstagramRouter;
