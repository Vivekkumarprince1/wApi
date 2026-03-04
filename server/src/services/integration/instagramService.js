/**
 * INSTAGRAM SERVICE
 * Instagram Business API integration for social media management
 */

const axios = require('axios');
const { getRedis, setJson, getJson } = require('../../config/redis');
const logger = require('../../utils/logger');
const { createError } = require('../../utils/errorFormatter');

class InstagramService {
  constructor() {
    this.redis = getRedis();
    this.baseUrl = 'https://graph.instagram.com';
    this.graphUrl = 'https://graph.facebook.com';
    this.tokenExpiry = 3600; // 1 hour
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code, redirectUri) {
    try {
      const response = await axios.get(`${this.graphUrl}/oauth/access_token`, {
        params: {
          client_id: process.env.INSTAGRAM_APP_ID,
          client_secret: process.env.INSTAGRAM_APP_SECRET,
          redirect_uri: redirectUri,
          code: code
        }
      });

      const { access_token, user_id } = response.data;

      // Cache the token
      const cacheKey = `instagram:token:${user_id}`;
      await setJson(cacheKey, {
        accessToken: access_token,
        userId: user_id,
        createdAt: new Date().toISOString()
      }, this.tokenExpiry);

      logger.info('Instagram access token obtained', { userId: user_id });
      return { accessToken: access_token, userId: user_id };
    } catch (error) {
      logger.error('Failed to exchange Instagram code for token', {
        error: error.response?.data || error.message
      });
      throw createError('INSTAGRAM_TOKEN_EXCHANGE_FAILED', 'Failed to obtain Instagram access token', 500);
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
          client_id: process.env.INSTAGRAM_APP_ID,
          client_secret: process.env.INSTAGRAM_APP_SECRET,
          fb_exchange_token: shortLivedToken
        }
      });

      return response.data.access_token;
    } catch (error) {
      logger.error('Failed to get long-lived Instagram token', {
        error: error.response?.data || error.message
      });
      throw createError('INSTAGRAM_LONG_LIVED_TOKEN_FAILED', 'Failed to obtain long-lived token', 500);
    }
  }

  /**
   * Get user pages and Instagram accounts
   */
  async getUserAccounts(userId, accessToken) {
    try {
      // Get user's pages
      const pagesResponse = await axios.get(`${this.graphUrl}/me/accounts`, {
        params: {
          access_token: accessToken
        }
      });

      const accounts = [];

      for (const page of pagesResponse.data.data) {
        try {
          // Get Instagram account for each page
          const igResponse = await axios.get(`${this.graphUrl}/${page.id}`, {
            params: {
              fields: 'instagram_business_account',
              access_token: accessToken
            }
          });

          if (igResponse.data.instagram_business_account) {
            const igAccount = igResponse.data.instagram_business_account;

            // Get Instagram account details
            const igDetails = await axios.get(`${this.graphUrl}/${igAccount.id}`, {
              params: {
                fields: 'id,username,name,profile_picture_url,biography',
                access_token: accessToken
              }
            });

            accounts.push({
              pageId: page.id,
              pageName: page.name,
              instagramAccount: {
                id: igDetails.data.id,
                username: igDetails.data.username,
                name: igDetails.data.name,
                profilePicture: igDetails.data.profile_picture_url,
                biography: igDetails.data.biography
              }
            });
          }
        } catch (error) {
          logger.warn('Failed to get Instagram account for page', {
            pageId: page.id,
            error: error.message
          });
        }
      }

      return accounts;
    } catch (error) {
      logger.error('Failed to get Instagram user accounts', {
        userId,
        error: error.response?.data || error.message
      });
      throw createError('INSTAGRAM_ACCOUNTS_FETCH_FAILED', 'Failed to fetch Instagram accounts', 500);
    }
  }

  /**
   * Get Instagram account insights
   */
  async getAccountInsights(accountId, accessToken, since, until) {
    try {
      const response = await axios.get(`${this.graphUrl}/${accountId}/insights`, {
        params: {
          metric: 'follower_count,impressions,reach,profile_views',
          period: 'day',
          since: since,
          until: until,
          access_token: accessToken
        }
      });

      return response.data.data;
    } catch (error) {
      logger.error('Failed to get Instagram account insights', {
        accountId,
        error: error.response?.data || error.message
      });
      throw createError('INSTAGRAM_INSIGHTS_FETCH_FAILED', 'Failed to fetch Instagram insights', 500);
    }
  }

  /**
   * Get media posts
   */
  async getMedia(accountId, accessToken, limit = 25) {
    try {
      const response = await axios.get(`${this.graphUrl}/${accountId}/media`, {
        params: {
          fields: 'id,media_type,media_url,permalink,caption,timestamp,like_count,comments_count',
          limit: limit,
          access_token: accessToken
        }
      });

      return response.data.data;
    } catch (error) {
      logger.error('Failed to get Instagram media', {
        accountId,
        error: error.response?.data || error.message
      });
      throw createError('INSTAGRAM_MEDIA_FETCH_FAILED', 'Failed to fetch Instagram media', 500);
    }
  }

  /**
   * Create a post
   */
  async createPost(accountId, accessToken, postData) {
    try {
      const containerResponse = await axios.post(`${this.graphUrl}/${accountId}/media`, {
        ...postData,
        access_token: accessToken
      });

      const containerId = containerResponse.data.id;

      // Publish the container
      const publishResponse = await axios.post(`${this.graphUrl}/${accountId}/media_publish`, {
        creation_id: containerId,
        access_token: accessToken
      });

      logger.info('Instagram post created', { accountId, postId: publishResponse.data.id });
      return publishResponse.data;
    } catch (error) {
      logger.error('Failed to create Instagram post', {
        accountId,
        error: error.response?.data || error.message
      });
      throw createError('INSTAGRAM_POST_CREATION_FAILED', 'Failed to create Instagram post', 500);
    }
  }

  /**
   * Send message via Instagram Messaging API
   */
  async sendMessage(recipientId, message, accessToken) {
    try {
      const response = await axios.post(`${this.graphUrl}/me/messages`, {
        recipient: { id: recipientId },
        message: { text: message },
        access_token: accessToken
      });

      logger.info('Instagram message sent', { recipientId, messageId: response.data.message_id });
      return response.data;
    } catch (error) {
      logger.error('Failed to send Instagram message', {
        recipientId,
        error: error.response?.data || error.message
      });
      throw createError('INSTAGRAM_MESSAGE_SEND_FAILED', 'Failed to send Instagram message', 500);
    }
  }

  /**
   * Handle Instagram webhooks
   */
  async handleWebhook(webhookData) {
    try {
      logger.info('Processing Instagram webhook', {
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
            default:
              logger.info('Unknown Instagram webhook field', { field: change.field });
          }
        }
      }

      return { processed: processedEvents.length, events: processedEvents };
    } catch (error) {
      logger.error('Failed to process Instagram webhook', {
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
    // Implementation for handling incoming messages
    logger.info('Instagram message received', {
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
    // Implementation for handling postbacks
    logger.info('Instagram postback received', {
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
    // Implementation for handling delivery confirmations
    logger.info('Instagram delivery confirmation', {
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
   * Set up Instagram webhook
   */
  async setupWebhook(pageAccessToken, callbackUrl, verifyToken) {
    try {
      // Subscribe to page events
      await axios.post(`${this.graphUrl}/me/subscribed_apps`, {
        subscribed_fields: 'messages,messaging_postbacks,message_deliveries',
        access_token: pageAccessToken
      });

      logger.info('Instagram webhook setup completed');
      return { success: true };
    } catch (error) {
      logger.error('Failed to setup Instagram webhook', {
        error: error.response?.data || error.message
      });
      throw createError('INSTAGRAM_WEBHOOK_SETUP_FAILED', 'Failed to setup Instagram webhook', 500);
    }
  }

  /**
   * Verify webhook
   */
  verifyWebhook(mode, token, challenge) {
    if (mode === 'subscribe' && token === process.env.INSTAGRAM_VERIFY_TOKEN) {
      return challenge;
    }
    throw createError('INSTAGRAM_WEBHOOK_VERIFICATION_FAILED', 'Webhook verification failed', 403);
  }

  /**
   * Refresh access token
   */
  async refreshToken(userId) {
    try {
      const cacheKey = `instagram:token:${userId}`;
      const cached = await getJson(cacheKey);

      if (!cached) {
        throw createError('TOKEN_NOT_FOUND', 'No cached token found', 404);
      }

      const newToken = await this.getLongLivedToken(cached.accessToken);

      await setJson(cacheKey, {
        accessToken: newToken,
        userId: userId,
        createdAt: new Date().toISOString()
      }, this.tokenExpiry);

      logger.info('Instagram token refreshed', { userId });
      return { accessToken: newToken };
    } catch (error) {
      logger.error('Failed to refresh Instagram token', { userId, error: error.message });
      throw error;
    }
  }
}

module.exports = new InstagramService();