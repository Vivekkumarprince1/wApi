/**
 * FACEBOOK SERVICE
 * Facebook Business API integration for social media management
 */

const axios = require('axios');
const { getRedis, setJson, getJson } = require('../../config/redis');
const logger = require('../../utils/logger');
const { createError } = require('../../utils/errorFormatter');

class FacebookService {
  constructor() {
    this.redis = getRedis();
    this.graphUrl = 'https://graph.facebook.com';
    this.version = 'v18.0';
    this.tokenExpiry = 3600; // 1 hour
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code, redirectUri) {
    try {
      const response = await axios.get(`${this.graphUrl}/oauth/access_token`, {
        params: {
          client_id: process.env.FACEBOOK_APP_ID,
          client_secret: process.env.FACEBOOK_APP_SECRET,
          redirect_uri: redirectUri,
          code: code
        }
      });

      const { access_token, expires_in } = response.data;

      // Get user ID
      const userResponse = await axios.get(`${this.graphUrl}/me`, {
        params: { access_token, fields: 'id' }
      });

      const userId = userResponse.data.id;

      // Cache the token
      const cacheKey = `facebook:token:${userId}`;
      await setJson(cacheKey, {
        accessToken: access_token,
        userId: userId,
        expiresIn: expires_in,
        createdAt: new Date().toISOString()
      }, this.tokenExpiry);

      logger.info('Facebook access token obtained', { userId });
      return { accessToken: access_token, userId, expiresIn: expires_in };
    } catch (error) {
      logger.error('Failed to exchange Facebook code for token', {
        error: error.response?.data || error.message
      });
      throw createError('FACEBOOK_TOKEN_EXCHANGE_FAILED', 'Failed to obtain Facebook access token', 500);
    }
  }

  /**
   * Get long-lived access token
   */
  async getLongLivedToken(shortLivedToken) {
    try {
      const response = await axios.get(`${this.graphUrl}/oauth/access_token`, {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: process.env.FACEBOOK_APP_ID,
          client_secret: process.env.FACEBOOK_APP_SECRET,
          fb_exchange_token: shortLivedToken
        }
      });

      return {
        accessToken: response.data.access_token,
        expiresIn: response.data.expires_in
      };
    } catch (error) {
      logger.error('Failed to get long-lived Facebook token', {
        error: error.response?.data || error.message
      });
      throw createError('FACEBOOK_LONG_LIVED_TOKEN_FAILED', 'Failed to obtain long-lived token', 500);
    }
  }

  /**
   * Get user pages
   */
  async getUserPages(userId, accessToken) {
    try {
      const response = await axios.get(`${this.graphUrl}/${this.version}/me/accounts`, {
        params: {
          access_token: accessToken,
          fields: 'id,name,category,about,website,phone,emails,location,picture'
        }
      });

      return response.data.data.map(page => ({
        id: page.id,
        name: page.name,
        category: page.category,
        about: page.about,
        website: page.website,
        phone: page.phone,
        emails: page.emails,
        location: page.location,
        picture: page.picture?.data?.url
      }));
    } catch (error) {
      logger.error('Failed to get Facebook user pages', {
        userId,
        error: error.response?.data || error.message
      });
      throw createError('FACEBOOK_PAGES_FETCH_FAILED', 'Failed to fetch Facebook pages', 500);
    }
  }

  /**
   * Get page insights
   */
  async getPageInsights(pageId, accessToken, since, until, metrics = []) {
    try {
      const defaultMetrics = [
        'page_fans',
        'page_impressions',
        'page_engaged_users',
        'page_post_engagements'
      ];

      const requestedMetrics = metrics.length > 0 ? metrics : defaultMetrics;

      const response = await axios.get(`${this.graphUrl}/${this.version}/${pageId}/insights`, {
        params: {
          metric: requestedMetrics.join(','),
          period: 'day',
          since: since,
          until: until,
          access_token: accessToken
        }
      });

      return response.data.data;
    } catch (error) {
      logger.error('Failed to get Facebook page insights', {
        pageId,
        error: error.response?.data || error.message
      });
      throw createError('FACEBOOK_INSIGHTS_FETCH_FAILED', 'Failed to fetch Facebook insights', 500);
    }
  }

  /**
   * Get page posts
   */
  async getPagePosts(pageId, accessToken, limit = 25) {
    try {
      const response = await axios.get(`${this.graphUrl}/${this.version}/${pageId}/posts`, {
        params: {
          fields: 'id,message,story,created_time,type,permalink_url,picture,full_picture,attachments{type,url,title},insights.metric(post_impressions,post_engaged_users)',
          limit: limit,
          access_token: accessToken
        }
      });

      return response.data.data;
    } catch (error) {
      logger.error('Failed to get Facebook page posts', {
        pageId,
        error: error.response?.data || error.message
      });
      throw createError('FACEBOOK_POSTS_FETCH_FAILED', 'Failed to fetch Facebook posts', 500);
    }
  }

  /**
   * Create a post
   */
  async createPost(pageId, accessToken, postData) {
    try {
      const response = await axios.post(`${this.graphUrl}/${this.version}/${pageId}/feed`, {
        ...postData,
        access_token: accessToken
      });

      logger.info('Facebook post created', { pageId, postId: response.data.id });
      return response.data;
    } catch (error) {
      logger.error('Failed to create Facebook post', {
        pageId,
        error: error.response?.data || error.message
      });
      throw createError('FACEBOOK_POST_CREATION_FAILED', 'Failed to create Facebook post', 500);
    }
  }

  /**
   * Send message via Facebook Messenger
   */
  async sendMessage(recipientId, message, pageAccessToken) {
    try {
      const response = await axios.post(`${this.graphUrl}/${this.version}/me/messages`, {
        recipient: { id: recipientId },
        message: { text: message },
        access_token: pageAccessToken
      });

      logger.info('Facebook message sent', { recipientId, messageId: response.data.message_id });
      return response.data;
    } catch (error) {
      logger.error('Failed to send Facebook message', {
        recipientId,
        error: error.response?.data || error.message
      });
      throw createError('FACEBOOK_MESSAGE_SEND_FAILED', 'Failed to send Facebook message', 500);
    }
  }

  /**
   * Handle Facebook webhooks
   */
  async handleWebhook(webhookData) {
    try {
      logger.info('Processing Facebook webhook', {
        object: webhookData.object,
        entries: webhookData.entry?.length
      });

      const processedEvents = [];

      for (const entry of webhookData.entry || []) {
        for (const change of entry.changes || []) {
          switch (change.field) {
            case 'messages':
              processedEvents.push(await this.processMessageEvent(change.value));
              break;
            case 'messaging_postbacks':
              processedEvents.push(await this.processPostbackEvent(change.value));
              break;
            case 'message_deliveries':
              processedEvents.push(await this.processDeliveryEvent(change.value));
              break;
            case 'feed':
              processedEvents.push(await this.processFeedEvent(change.value));
              break;
            default:
              logger.info('Unknown Facebook webhook field', { field: change.field });
          }
        }
      }

      return { processed: processedEvents.length, events: processedEvents };
    } catch (error) {
      logger.error('Failed to process Facebook webhook', {
        error: error.message,
        webhookData
      });
      throw error;
    }
  }

  /**
   * Process incoming message event
   */
  async processMessageEvent(messageData) {
    logger.info('Facebook message received', {
      from: messageData.from,
      message: messageData.message?.text?.substring(0, 50)
    });

    return {
      type: 'message',
      from: messageData.from,
      message: messageData.message,
      timestamp: messageData.timestamp
    };
  }

  /**
   * Process postback event
   */
  async processPostbackEvent(postbackData) {
    logger.info('Facebook postback received', {
      from: postbackData.from,
      payload: postbackData.postback?.payload
    });

    return {
      type: 'postback',
      from: postbackData.from,
      postback: postbackData.postback,
      timestamp: postbackData.timestamp
    };
  }

  /**
   * Process delivery event
   */
  async processDeliveryEvent(deliveryData) {
    logger.info('Facebook delivery confirmation', {
      messageId: deliveryData.message?.mid,
      watermark: deliveryData.watermark
    });

    return {
      type: 'delivery',
      messageId: deliveryData.message?.mid,
      watermark: deliveryData.watermark
    };
  }

  /**
   * Process feed event
   */
  async processFeedEvent(feedData) {
    logger.info('Facebook feed event', {
      postId: feedData.post_id,
      verb: feedData.verb
    });

    return {
      type: 'feed',
      postId: feedData.post_id,
      verb: feedData.verb,
      item: feedData.item
    };
  }

  /**
   * Set up Facebook webhook
   */
  async setupWebhook(pageAccessToken, callbackUrl, verifyToken) {
    try {
      // Subscribe to page events
      await axios.post(`${this.graphUrl}/${this.version}/me/subscribed_apps`, {
        subscribed_fields: 'messages,messaging_postbacks,message_deliveries,feed',
        access_token: pageAccessToken
      });

      logger.info('Facebook webhook setup completed');
      return { success: true };
    } catch (error) {
      logger.error('Failed to setup Facebook webhook', {
        error: error.response?.data || error.message
      });
      throw createError('FACEBOOK_WEBHOOK_SETUP_FAILED', 'Failed to setup Facebook webhook', 500);
    }
  }

  /**
   * Verify webhook
   */
  verifyWebhook(mode, token, challenge) {
    if (mode === 'subscribe' && token === process.env.FACEBOOK_VERIFY_TOKEN) {
      return challenge;
    }
    throw createError('FACEBOOK_WEBHOOK_VERIFICATION_FAILED', 'Webhook verification failed', 403);
  }

  /**
   * Get page conversations
   */
  async getPageConversations(pageId, accessToken, limit = 25) {
    try {
      const response = await axios.get(`${this.graphUrl}/${this.version}/${pageId}/conversations`, {
        params: {
          fields: 'id,updated_time,messages.limit(1){message,created_time,from},participants',
          limit: limit,
          access_token: accessToken
        }
      });

      return response.data.data;
    } catch (error) {
      logger.error('Failed to get Facebook page conversations', {
        pageId,
        error: error.response?.data || error.message
      });
      throw createError('FACEBOOK_CONVERSATIONS_FETCH_FAILED', 'Failed to fetch Facebook conversations', 500);
    }
  }

  /**
   * Get conversation messages
   */
  async getConversationMessages(conversationId, accessToken, limit = 50) {
    try {
      const response = await axios.get(`${this.graphUrl}/${this.version}/${conversationId}`, {
        params: {
          fields: `messages.limit(${limit}){message,created_time,from,to,attachments}`,
          access_token: accessToken
        }
      });

      return response.data.messages?.data || [];
    } catch (error) {
      logger.error('Failed to get Facebook conversation messages', {
        conversationId,
        error: error.response?.data || error.message
      });
      throw createError('FACEBOOK_MESSAGES_FETCH_FAILED', 'Failed to fetch Facebook messages', 500);
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(userId) {
    try {
      const cacheKey = `facebook:token:${userId}`;
      const cached = await getJson(cacheKey);

      if (!cached) {
        throw createError('TOKEN_NOT_FOUND', 'No cached token found', 404);
      }

      const newTokenData = await this.getLongLivedToken(cached.accessToken);

      await setJson(cacheKey, {
        accessToken: newTokenData.accessToken,
        userId: userId,
        expiresIn: newTokenData.expiresIn,
        createdAt: new Date().toISOString()
      }, this.tokenExpiry);

      logger.info('Facebook token refreshed', { userId });
      return newTokenData;
    } catch (error) {
      logger.error('Failed to refresh Facebook token', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Create Facebook ad campaign
   */
  async createAdCampaign(adAccountId, accessToken, campaignData) {
    try {
      const response = await axios.post(`${this.graphUrl}/${this.version}/act_${adAccountId}/campaigns`, {
        ...campaignData,
        access_token: accessToken
      });

      logger.info('Facebook ad campaign created', { adAccountId, campaignId: response.data.id });
      return response.data;
    } catch (error) {
      logger.error('Failed to create Facebook ad campaign', {
        adAccountId,
        error: error.response?.data || error.message
      });
      throw createError('FACEBOOK_AD_CREATION_FAILED', 'Failed to create Facebook ad campaign', 500);
    }
  }

  /**
   * Get ad account insights
   */
  async getAdAccountInsights(adAccountId, accessToken, datePreset = 'last_30d') {
    try {
      const response = await axios.get(`${this.graphUrl}/${this.version}/act_${adAccountId}/insights`, {
        params: {
          fields: 'campaign_name,impressions,clicks,spend,actions,cost_per_action_type',
          date_preset: datePreset,
          access_token: accessToken
        }
      });

      return response.data.data;
    } catch (error) {
      logger.error('Failed to get Facebook ad account insights', {
        adAccountId,
        error: error.response?.data || error.message
      });
      throw createError('FACEBOOK_AD_INSIGHTS_FETCH_FAILED', 'Failed to fetch Facebook ad insights', 500);
    }
  }
}

module.exports = new FacebookService();