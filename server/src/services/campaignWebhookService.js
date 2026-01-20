const Campaign = require('../models/Campaign');
const CampaignBatch = require('../models/CampaignBatch');
const CampaignMessage = require('../models/CampaignMessage');
const Message = require('../models/Message');

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * CAMPAIGN WEBHOOK SERVICE - Stage 3 Implementation
 * 
 * Handles webhook status updates and rolls them up into campaign totals.
 * Called from the main webhook controller when a message status update arrives.
 * 
 * Flow:
 * 1. Message status webhook arrives (sent/delivered/read/failed)
 * 2. Check if message belongs to a campaign
 * 3. Update CampaignMessage record
 * 4. Roll up into Campaign totals atomically
 * ═══════════════════════════════════════════════════════════════════════════════
 */

/**
 * Process a message status update for campaign tracking
 * @param {String} whatsappMessageId - The wamid from Meta
 * @param {String} status - New status (sent/delivered/read/failed)
 * @param {Date} timestamp - Status timestamp
 * @param {Object} statusData - Full status payload from webhook
 * @returns {Promise<Object>} - Result of the update
 */
async function processCampaignStatusUpdate(whatsappMessageId, status, timestamp, statusData = {}) {
  try {
    // Find the message by WhatsApp ID
    const message = await Message.findOne({ 
      whatsappMessageId: whatsappMessageId 
    }).select('_id meta workspace contact');
    
    if (!message) {
      // Not a tracked message, skip
      return { processed: false, reason: 'message_not_found' };
    }
    
    // Check if this is a campaign message
    const campaignId = message.meta?.campaignId;
    if (!campaignId) {
      // Not a campaign message, skip campaign processing
      return { processed: false, reason: 'not_campaign_message' };
    }
    
    // Find or create CampaignMessage record
    let campaignMessage = await CampaignMessage.findOne({
      campaign: campaignId,
      $or: [
        { whatsappMessageId: whatsappMessageId },
        { message: message._id },
        { contact: message.contact }
      ]
    });
    
    if (!campaignMessage) {
      // Create if doesn't exist (edge case - message created outside batch process)
      campaignMessage = await CampaignMessage.create({
        workspace: message.workspace,
        campaign: campaignId,
        message: message._id,
        contact: message.contact,
        whatsappMessageId: whatsappMessageId,
        status: status,
        sentAt: status === 'sent' ? timestamp : undefined,
        deliveredAt: status === 'delivered' ? timestamp : undefined,
        readAt: status === 'read' ? timestamp : undefined,
        failedAt: status === 'failed' ? timestamp : undefined,
        failureReason: statusData.errors?.[0]?.message
      });
    } else {
      // Determine if this is a status progression (not a downgrade)
      const statusOrder = ['queued', 'sending', 'sent', 'delivered', 'read'];
      const currentIndex = statusOrder.indexOf(campaignMessage.status);
      const newIndex = statusOrder.indexOf(status);
      
      // Only update if new status is a progression (or it's a failure)
      if (status === 'failed' || newIndex > currentIndex) {
        const updateData = { 
          status: status,
          updatedAt: new Date()
        };
        
        // Set timestamp based on status
        if (status === 'sent' && !campaignMessage.sentAt) {
          updateData.sentAt = timestamp;
        } else if (status === 'delivered' && !campaignMessage.deliveredAt) {
          updateData.deliveredAt = timestamp;
        } else if (status === 'read' && !campaignMessage.readAt) {
          updateData.readAt = timestamp;
        } else if (status === 'failed') {
          updateData.failedAt = timestamp;
          updateData.failureReason = statusData.errors?.[0]?.message || 'Unknown error';
        }
        
        if (!campaignMessage.whatsappMessageId) {
          updateData.whatsappMessageId = whatsappMessageId;
        }
        
        await CampaignMessage.findByIdAndUpdate(campaignMessage._id, { $set: updateData });
      } else {
        // Status is not a progression, skip update
        return { 
          processed: false, 
          reason: 'status_not_progression',
          currentStatus: campaignMessage.status,
          newStatus: status
        };
      }
    }
    
    // Roll up to campaign totals
    const rollupResult = await rollupCampaignStats(campaignId, status, campaignMessage.status);
    
    // Update batch if we can find it
    const batch = await CampaignBatch.findOne({
      campaign: campaignId,
      'recipients.contactId': message.contact
    });
    
    if (batch) {
      // Update recipient status in batch
      const recipient = batch.recipients.find(
        r => r.contactId.toString() === message.contact.toString()
      );
      
      if (recipient && !['sent', 'delivered', 'read'].includes(recipient.status)) {
        recipient.status = status;
        recipient.processedAt = timestamp;
        if (status === 'failed') {
          recipient.error = statusData.errors?.[0]?.message;
        }
        
        // Update batch stats
        if (status === 'delivered') {
          batch.stats.delivered = (batch.stats.delivered || 0) + 1;
        } else if (status === 'read') {
          batch.stats.read = (batch.stats.read || 0) + 1;
        }
        
        await batch.save();
      }
    }
    
    return {
      processed: true,
      campaignId,
      campaignMessageId: campaignMessage._id,
      status,
      rollup: rollupResult
    };
  } catch (err) {
    console.error('[CampaignWebhook] Error processing status update:', err);
    return { 
      processed: false, 
      error: err.message 
    };
  }
}

/**
 * Roll up status counts to campaign totals
 * Uses atomic operations to prevent race conditions
 * 
 * @param {ObjectId} campaignId 
 * @param {String} newStatus - The new status
 * @param {String} previousStatus - The previous status (to avoid double counting)
 */
async function rollupCampaignStats(campaignId, newStatus, previousStatus) {
  // Define which fields to increment based on status
  const statusFields = {
    'sent': 'sent',
    'delivered': 'delivered',
    'read': 'read',
    'failed': 'failed',
    'replied': 'replied'
  };
  
  const field = statusFields[newStatus];
  if (!field) {
    return { skipped: true, reason: 'unknown_status' };
  }
  
  // Don't double count if status hasn't changed
  if (previousStatus === newStatus) {
    return { skipped: true, reason: 'no_status_change' };
  }
  
  // Define progression to avoid double counting on rollup
  const progressionMap = {
    'sent': null,  // sent is first trackable status, always increment
    'delivered': 'sent', // delivered comes after sent
    'read': 'delivered', // read comes after delivered
    'failed': null // failed is terminal, always increment if not already failed
  };
  
  // Build the update operation
  const update = {
    $inc: {},
    $set: { updatedAt: new Date() }
  };
  
  // Increment both new totals structure and legacy fields
  update.$inc[`totals.${field}`] = 1;
  update.$inc[`${field}Count`] = 1;
  
  // Execute atomic update
  const result = await Campaign.findByIdAndUpdate(
    campaignId,
    update,
    { new: true }
  );
  
  if (!result) {
    return { skipped: true, reason: 'campaign_not_found' };
  }
  
  // Check for campaign completion
  const processed = (result.totals?.sent || result.sentCount || 0) + 
                   (result.totals?.failed || result.failedCount || 0);
  const total = result.totals?.totalRecipients || result.totalContacts || 0;
  
  let completionTriggered = false;
  
  if (processed >= total && total > 0 && result.status === 'RUNNING') {
    // Mark campaign as completed
    await Campaign.findByIdAndUpdate(campaignId, {
      $set: {
        status: 'COMPLETED',
        completedAt: new Date()
      }
    });
    completionTriggered = true;
  }
  
  return {
    updated: true,
    field,
    newValue: result.totals?.[field] || result[`${field}Count`],
    completionTriggered
  };
}

/**
 * Process a reply to a campaign message
 * Increments the replied counter
 * 
 * @param {ObjectId} contactId 
 * @param {ObjectId} workspaceId 
 */
async function processCampaignReply(contactId, workspaceId) {
  try {
    // Find the most recent campaign message to this contact
    const recentCampaignMessage = await CampaignMessage.findOne({
      workspace: workspaceId,
      contact: contactId,
      status: { $in: ['sent', 'delivered', 'read'] }
    }).sort({ sentAt: -1 }).limit(1);
    
    if (!recentCampaignMessage) {
      return { processed: false, reason: 'no_recent_campaign_message' };
    }
    
    // Check if already counted as replied (within last 24 hours)
    const lastDay = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if (recentCampaignMessage.sentAt && new Date(recentCampaignMessage.sentAt) < lastDay) {
      return { processed: false, reason: 'message_too_old' };
    }
    
    // Increment campaign replied count
    const result = await Campaign.findByIdAndUpdate(
      recentCampaignMessage.campaign,
      {
        $inc: {
          'totals.replied': 1,
          repliedCount: 1
        }
      },
      { new: true }
    );
    
    return {
      processed: true,
      campaignId: recentCampaignMessage.campaign,
      replied: result.totals?.replied || result.repliedCount
    };
  } catch (err) {
    console.error('[CampaignWebhook] Error processing reply:', err);
    return { processed: false, error: err.message };
  }
}

/**
 * Handle campaign failure conditions from webhook
 * Called when we detect critical errors that should pause the campaign
 * 
 * @param {ObjectId} campaignId 
 * @param {String} reason - Pause reason code
 * @param {String} errorMessage - Detailed error message
 */
async function handleCampaignFailure(campaignId, reason, errorMessage) {
  try {
    const campaign = await Campaign.findById(campaignId);
    
    if (!campaign || campaign.status !== 'RUNNING') {
      return { handled: false, reason: 'campaign_not_running' };
    }
    
    // Update campaign to paused/failed
    campaign.status = reason === 'ACCOUNT_BLOCKED' || reason === 'TOKEN_EXPIRED' ? 'FAILED' : 'PAUSED';
    campaign.pausedReason = reason;
    campaign.pausedAt = new Date();
    campaign.failureTracking = campaign.failureTracking || {};
    campaign.failureTracking.lastFailureAt = new Date();
    campaign.failureTracking.lastFailureError = errorMessage;
    
    if (!campaign.failureTracking.metaErrorCodes) {
      campaign.failureTracking.metaErrorCodes = [];
    }
    campaign.failureTracking.metaErrorCodes.push(reason);
    
    await campaign.save();
    
    // Update any pending batches
    await CampaignBatch.updateMany(
      { campaign: campaignId, status: { $in: ['PENDING', 'QUEUED', 'PROCESSING'] } },
      { $set: { status: 'PAUSED' } }
    );
    
    console.log(`[CampaignWebhook] Campaign ${campaignId} marked as ${campaign.status}: ${reason}`);
    
    return {
      handled: true,
      campaignId,
      newStatus: campaign.status,
      reason
    };
  } catch (err) {
    console.error('[CampaignWebhook] Error handling campaign failure:', err);
    return { handled: false, error: err.message };
  }
}

/**
 * Sync campaign stats from CampaignMessage records
 * Used for recovery or periodic reconciliation
 * 
 * @param {ObjectId} campaignId 
 */
async function syncCampaignStats(campaignId) {
  try {
    // Aggregate stats from CampaignMessage
    const stats = await CampaignMessage.aggregate([
      { $match: { campaign: campaignId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Build totals object
    const totals = {
      queued: 0,
      sent: 0,
      delivered: 0,
      read: 0,
      failed: 0
    };
    
    for (const stat of stats) {
      if (totals.hasOwnProperty(stat._id)) {
        totals[stat._id] = stat.count;
      }
    }
    
    // Get total recipients count
    const totalRecipients = await CampaignMessage.countDocuments({ campaign: campaignId });
    totals.totalRecipients = totalRecipients;
    
    // Update campaign
    const result = await Campaign.findByIdAndUpdate(
      campaignId,
      {
        $set: {
          totals: totals,
          totalContacts: totalRecipients,
          sentCount: totals.sent,
          deliveredCount: totals.delivered,
          readCount: totals.read,
          failedCount: totals.failed,
          updatedAt: new Date()
        }
      },
      { new: true }
    );
    
    return {
      synced: true,
      campaignId,
      totals: result.totals
    };
  } catch (err) {
    console.error('[CampaignWebhook] Error syncing campaign stats:', err);
    return { synced: false, error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  processCampaignStatusUpdate,
  rollupCampaignStats,
  processCampaignReply,
  handleCampaignFailure,
  syncCampaignStats
};
