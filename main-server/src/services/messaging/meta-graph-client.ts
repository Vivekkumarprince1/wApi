import axios from 'axios';
import { config } from '@/config';

export class MetaGraphClient {
  private static readonly GRAPH_URL = 'https://graph.facebook.com';
  private static readonly VERSION = 'v18.0';

  /**
   * Exchange short-lived token for long-lived access token
   */
  static async getLongLivedToken(shortLivedToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    try {
      const response = await axios.get(`${this.GRAPH_URL}/oauth/access_token`, {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: config.facebookAppId,
          client_secret: config.facebookAppSecret,
          fb_exchange_token: shortLivedToken
        }
      });

      return {
        accessToken: response.data.access_token,
        expiresIn: response.data.expires_in || (60 * 60 * 24 * 60) // Default 60 days
      };
    } catch (error: any) {
      throw new Error(error.response?.data?.error?.message || 'Failed to exchange token');
    }
  }

  /**
   * Get Instagram Business Account ID from Facebook Page
   */
  static async getInstagramAccountId(pageId: string, accessToken: string): Promise<string | null> {
    try {
      const response = await axios.get(`${this.GRAPH_URL}/${this.VERSION}/${pageId}`, {
        params: {
          fields: 'instagram_business_account',
          access_token: accessToken
        }
      });
      return response.data.instagram_business_account?.id || null;
    } catch (error: any) {
      throw new Error(error.response?.data?.error?.message || 'Failed to fetch IG account');
    }
  }

  /**
   * Setup Webhooks for an App/Page
   */
  static async subscribeToAppWebhooks(pageId: string, accessToken: string, fields: string[]): Promise<boolean> {
    try {
      await axios.post(`${this.GRAPH_URL}/${this.VERSION}/${pageId}/subscribed_apps`, {
        subscribed_fields: fields.join(','),
        access_token: accessToken
      });
      return true;
    } catch (error: any) {
      throw new Error(error.response?.data?.error?.message || 'Failed to subscribe webhooks');
    }
  }
}
