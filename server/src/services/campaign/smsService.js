const SMSConfig = require('../../models/workspace/SMSConfig');
const { Workspace } = require('../../models');
const axios = require('axios');

/**
 * Send an SMS message via Gupshup Single Messaging API
 */
async function sendSMSMessage(workspaceId, campaignId, contact, messageConfig) {
  try {
    const [config, workspace] = await Promise.all([
      SMSConfig.findOne({ workspaceId }),
      Workspace.findById(workspaceId)
    ]);

    if (!workspace) {
      throw new Error('Workspace not found');
    }

    // Determine credentials: Use SMSConfig if present, else fallback to Workspace Managed App ID/Key
    const apiKey = config?.credentials?.apiKey || workspace.gupshupIdentity?.appApiKey;
    const senderId = config?.credentials?.senderId || workspace.bspVerifiedName || 'WAPI';

    if (!apiKey) {
      console.error(`SMS Fallback failed for ${contact.phone}: No API Key found in Config or Workspace`);
      return { success: false, error: 'MISSING_CREDENTIALS' };
    }

    // Gupshup Single Messaging API Endpoint
    const url = 'https://api.gupshup.io/sm/api/v1/msg';
    
    // Build Payload for Gupshup SMS
    const message = {
      type: 'text',
      text: messageConfig.text || `Hello ${contact.name || 'there'}!`
    };

    const params = new URLSearchParams();
    params.append('channel', 'sms');
    params.append('source', senderId);
    params.append('destination', contact.phone);
    params.append('message', JSON.stringify(message));
    
    // Identity fields
    if (config?.credentials?.entityId) params.append('src.entityId', config.credentials.entityId);
    if (config?.credentials?.templateId) params.append('src.templateId', config.credentials.templateId);

    const response = await axios.post(url, params.toString(), {
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (response.data && (response.data.status === 'submitted' || response.data.status === 'success')) {
      console.log(`[SMS Fallback] Success for ${contact.phone}. MsgID: ${response.data.messageId}`);
      return { 
        success: true, 
        messageId: response.data.messageId,
        provider: 'GUPSHUP_SMS'
      };
    } else {
      throw new Error(response.data.message || 'Gupshup SMS submission failed');
    }
  } catch (err) {
    console.error(`SMS fallback send error:`, err.response?.data || err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  sendSMSMessage
};
