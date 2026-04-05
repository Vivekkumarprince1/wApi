const axios = require('axios');
const { RCSConfig, CampaignMessage, Campaign } = require('../../models');
const logger = require('../../utils/logger');

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * RCS SERVICE - JIO/CARRIER CHANNEL INTEGRATION
 * 
 * Handles fallback messaging when WhatsApp delivery fails.
 * 
 * Flow:
 * 1. Resolve RCS credentials for workspace
 * 2. Fetch RCS-equivalent template
 * 3. Map variables (WA -> RCS)
 * 4. Dispatch to provider (Jio)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

/**
 * Send RCS message (fallback)
 * 
 * @param {ObjectId} workspaceId 
 * @param {Object} recipient - { phone, variables }
 * @param {Object} fallbackConfig - { templateId, mapping }
 */
async function sendRCSMessage(workspaceId, recipient, fallbackConfig) {
  const { phone, variables, campaignId, originalMessageId } = recipient;
  
  try {
    // 1. Get RCS configuration for workspace
    const rcsConfig = await RCSConfig.findOne({ workspace: workspaceId, status: 'ACTIVE' });
    
    if (!rcsConfig) {
      logger.warn(`[RCS] No active RCS config for workspace ${workspaceId}. Fallback skipped.`);
      return { success: false, error: 'RCS_CONFIG_MISSING' };
    }
    
    // 2. Mocking RCS Payload (Jio/DLT Format)
    /* 
    const payload = {
      bot_id: rcsConfig.credentials.senderId,
      user_phone: phone,
      template_id: fallbackConfig.templateName || fallbackConfig.templateId,
      parameters: mappingVariables(variables, fallbackConfig.mapping)
    };
    */
    
    // For now, we mock the success response
    const mockProviderResponse = {
      status: 'submitted',
      provider_id: `rcs_jio_${Date.now()}_${Math.random().toString(36).slice(-4)}`,
      timestamp: new Date()
    };
    
    logger.info(`[RCS] Mock message submitted to Jio for ${phone} (Fallback from ${originalMessageId})`);
    
    // 3. Record RCS send in campaign totals
    if (campaignId) {
      await Campaign.findByIdAndUpdate(campaignId, {
        $inc: { 
          'totals.rcsSent': 1,
          'totals.failed': -1 // "Repairing" the failure count by moving it to RCS
        }
      });
    }
    
    // 4. Update the campaign message to indicate RCS channel
    await CampaignMessage.findByIdAndUpdate(originalMessageId, {
      $set: {
        channel: 'RCS',
        rcsProviderId: mockProviderResponse.provider_id,
        rcsStatus: 'SENT',
        lastError: null // Clear WA error as it's now falling back
      },
      $push: {
        attempts: {
          channel: 'RCS',
          at: new Date(),
          status: 'SENT',
          providerId: mockProviderResponse.provider_id
        }
      }
    });

    return { 
      success: true, 
      providerId: mockProviderResponse.provider_id 
    };

  } catch (error) {
    logger.error(`[RCS] sendRCSMessage failed:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Handle RCS Delivery Receipts (Webhook Mirror)
 * 
 * @param {Object} event - Delivery status update from Jio
 */
async function handleRCSWebhook(event) {
  const { messageId, status, timestamp } = event;
  
  // Map RCS status to campaign status
  const statusMap = {
    'delivered': 'DELIVERED',
    'read': 'READ',
    'failed': 'FAILED',
    'undelivered': 'FAILED'
  };
  
  const campaignStatus = statusMap[status.toLowerCase()] || 'SENT';
  
  const message = await CampaignMessage.findOne({ rcsProviderId: messageId });
  if (!message) return;
  
  message.rcsStatus = campaignStatus;
  await message.save();
  
  // Update campaign totals
  if (campaignStatus === 'DELIVERED') {
    await Campaign.findByIdAndUpdate(message.campaign, {
      $inc: { 'totals.rcsDelivered': 1 }
    });
  } else if (campaignStatus === 'FAILED') {
    await Campaign.findByIdAndUpdate(message.campaign, {
      $inc: { 'totals.rcsFailed': 1 }
    });
  }
  
  return { success: true };
}

module.exports = {
  sendRCSMessage,
  handleRCSWebhook
};
