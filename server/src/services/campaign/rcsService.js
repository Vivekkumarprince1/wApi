const RCSConfig = require('../../models/workspace/RCSConfig');
const axios = require('axios');

/**
 * Send an RCS message via the configured provider (Jio, etc.)
 */
async function sendRCSMessage(workspaceId, campaignId, contact, messageConfig) {
  try {
    const config = await RCSConfig.findOne({ workspaceId });
    if (!config || config.status !== 'ACTIVE') {
      console.error(`RCS Fallback failed for ${contact.phone}: No active RCS config for workspace ${workspaceId}`);
      return { success: false, error: 'NO_ACTIVE_RCS_CONFIG' };
    }

    // Mock Payload for Jio RCS
    const payload = {
      sender: config.credentials.senderId,
      recipient: contact.phone,
      templateId: messageConfig.templateId,
      variables: messageConfig.mapping,
      campaignId: campaignId
    };

    // Real API call (Mocked for now)
    // const response = await axios.post(config.credentials.endpoint, payload, {
    //   headers: { 'Authorization': `Bearer ${config.credentials.apiKey}` }
    // });
    
    console.log(`[RCS Fallback] Sending to ${contact.phone} via ${config.provider}`);
    
    // Simulate Success
    return { 
      success: true, 
      messageId: `RCS_${Math.random().toString(36).substring(7)}`,
      provider: config.provider 
    };
  } catch (err) {
    console.error(`RCS fallback send error:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Automatically map WhatsApp template variables to RCS
 */
function mapVariablesToRCS(waVariables, mapping) {
  // Simple 1:1 mapping for demonstration
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
