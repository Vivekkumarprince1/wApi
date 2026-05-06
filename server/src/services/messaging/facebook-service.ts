import axios from 'axios';

export class FacebookService {
  private static readonly GRAPH_URL = 'https://graph.facebook.com';
  private static readonly VERSION = 'v18.0';

  /**
   * Get user's Facebook Pages
   */
  static async getUserPages(accessToken: string): Promise<any[]> {
    try {
      const response = await axios.get(`${this.GRAPH_URL}/${this.VERSION}/me/accounts`, {
        params: {
          access_token: accessToken,
          fields: 'id,name,category,about,website,phone,emails,location,picture'
        }
      });

      return response.data.data.map((page: any) => ({
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
    } catch (error: any) {
      throw new Error(error.response?.data?.error?.message || 'Failed to fetch Facebook pages');
    }
  }

  /**
   * Send a Message via Facebook Messenger
   */
  static async sendMessage(recipientId: string, text: string, pageAccessToken: string): Promise<string> {
    try {
      const response = await axios.post(`${this.GRAPH_URL}/${this.VERSION}/me/messages`, {
        recipient: { id: recipientId },
        message: { text },
        access_token: pageAccessToken
      });

      return response.data.message_id;
    } catch (error: any) {
      throw new Error(error.response?.data?.error?.message || 'Failed to send Facebook Messenger message');
    }
  }

  /**
   * Reply to a Post/Feed comment
   */
  static async replyToComment(commentId: string, text: string, pageAccessToken: string): Promise<string> {
    try {
      const response = await axios.post(`${this.GRAPH_URL}/${this.VERSION}/${commentId}/comments`, {
        message: text,
        access_token: pageAccessToken
      });
      return response.data.id;
    } catch (error: any) {
      throw new Error(error.response?.data?.error?.message || 'Failed to reply to Facebook comment');
    }
  }
}
