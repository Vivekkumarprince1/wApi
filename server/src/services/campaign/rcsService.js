const RCSConfig = require('../../models/workspace/RCSConfig');
const { Workspace } = require('../../models');
const axios = require('axios');

/**
 * Send an RCS message via Gupshup Single Messaging API
 */
async function sendRCSMessage(workspaceId, campaignId, contact, messageConfig) {
  try {
    const [config, workspace] = await Promise.all([
      RCSConfig.findOne({ workspaceId }),
      Workspace.findById(workspaceId)
    ]);

    if (!workspace) {
      throw new Error('Workspace not found');
    }

    // Determine credentials: Use RCSConfig if present, else fallback to Workspace Managed App ID/Key
    const apiKey = config?.credentials?.apiKey || workspace.gupshupIdentity?.appApiKey;
    const appId = config?.credentials?.appId || workspace.gupshupAppId || workspace.gupshupIdentity?.partnerAppId;
    const senderId = config?.credentials?.senderId || workspace.bspVerifiedName || 'WAPI';

    if (!apiKey) {
      console.error(`RCS Fallback failed for ${contact.phone}: No API Key found in Config or Workspace`);
      return { success: false, error: 'MISSING_CREDENTIALS' };
    }

    // Gupshup Single Messaging API Endpoint
    const url = 'https://api.gupshup.io/sm/api/v1/msg';
    
    // Build Payload for Gupshup RCS
    const message = {
      type: 'text',
      text: messageConfig.text || `Hello ${contact.name || 'there'}!`,
    };

    const params = new URLSearchParams();
    params.append('channel', 'rcs');
    params.append('source', senderId);
    params.append('destination', contact.phone);
    params.append('message', JSON.stringify(message));
    params.append('src.name', senderId);

    const response = await axios.post(url, params.toString(), {
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (response.data && (response.data.status === 'submitted' || response.data.status === 'success')) {
      console.log(`[RCS Fallback] Success for ${contact.phone}. MsgID: ${response.data.messageId}`);
      return { 
        success: true, 
        messageId: response.data.messageId,
        provider: 'GUPSHUP_RCS'
      };
    } else {
      throw new Error(response.data.message || 'Gupshup RCS submission failed');
    }
  } catch (err) {
    console.error(`RCS fallback send error:`, err.response?.data || err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Automatically map WhatsApp template variables to RCS
 */
function mapVariablesToRCS(waVariables, mapping) {
  // Simple mapping
  const rcsMapping = {};
  for (const [key, value] of Object.entries(mapping)) {
    rcsMapping[key] = value;
  }
  return rcsMapping;
}

module.exports = {
  sendRCSMessage,
  mapVariablesToRCS
};
