import { MetaGraphClient } from './meta-graph-client';
import axios from 'axios';

export class InstagramService {
  private static readonly GRAPH_URL = 'https://graph.facebook.com';
  private static readonly VERSION = 'v18.0';

  /**
   * Send an Instagram Direct Message (DM)
   */
  static async sendDM(recipientId: string, text: string, pageAccessToken: string): Promise<string> {
    try {
      const response = await axios.post(`${this.GRAPH_URL}/${this.VERSION}/me/messages`, {
        recipient: { id: recipientId },
        message: { text },
        access_token: pageAccessToken
      });
      return response.data.message_id;
    } catch (error: any) {
      throw new Error(error.response?.data?.error?.message || 'Failed to send Instagram DM');
    }
  }

  /**
   * Reply to an Instagram Comment
   */
  static async replyToComment(commentId: string, text: string, pageAccessToken: string): Promise<string> {
    try {
      const response = await axios.post(`${this.GRAPH_URL}/${this.VERSION}/${commentId}/replies`, {
        message: text,
        access_token: pageAccessToken
      });
      return response.data.id;
    } catch (error: any) {
      throw new Error(error.response?.data?.error?.message || 'Failed to reply to comment');
    }
  }

  /**
   * Fetch connected Instagram Business Accounts for a given User Access Token
   */
  static async getUserAccounts(accessToken: string): Promise<any[]> {
    try {
      const pagesResponse = await axios.get(`${this.GRAPH_URL}/${this.VERSION}/me/accounts`, {
        params: { access_token: accessToken }
      });

      const accounts: any[] = [];
      for (const page of pagesResponse.data.data) {
        const igAccountId = await MetaGraphClient.getInstagramAccountId(page.id, accessToken);
        if (igAccountId) {
          const igDetails = await axios.get(`${this.GRAPH_URL}/${this.VERSION}/${igAccountId}`, {
            params: {
              fields: 'id,username,name,profile_picture_url,biography',
              access_token: accessToken
            }
          });
          accounts.push({
            pageId: page.id,
            pageName: page.name,
            instagramAccount: igDetails.data
          });
        }
      }
      return accounts;
    } catch (error: any) {
      throw new Error(error.response?.data?.error?.message || 'Failed to fetch User Accounts');
    }
  }
}
