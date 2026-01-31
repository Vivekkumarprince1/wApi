const axios = require('axios');
const Message = require('../models/Message');
const Workspace = require('../models/Workspace');
const metaService = require('./metaService');
const { createQueue } = require('./queue');

// create a BullMQ queue for WhatsApp sends
const sendQueue = createQueue('whatsapp-sends');

async function enqueueSend(messageId, opts = {}) {
  // job options can include attempts and backoff
  await sendQueue.add(
    'send', 
    { messageId }, 
    { 
      jobId: `send:${messageId}`, // Idempotency key
      attempts: opts.attempts || 5, 
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 1000
    }
  );
}

async function processSendJob(job) {
  const { messageId, campaignId, contactId } = job.data;
  
  // Handle campaign messages
  if (campaignId && contactId && !messageId) {
    return await processCampaignMessage(job);
  }
  
  // Handle regular messages
  if (!messageId) {
    throw new Error('Message ID required');
  }
  
  const message = await Message.findById(messageId).populate('contact').populate('workspace');
  if (!message) throw new Error('Message not found');
  
  const workspace = await Workspace.findById(message.workspace);
  if (!workspace) throw new Error('Workspace not found');
  
  const to = message.meta?.to || (message.contact && message.contact.phone);
  if (!to) throw new Error('No recipient phone');
  
  // Get credentials from workspace
  const accessToken = workspace.whatsappAccessToken;
  const phoneNumberId = workspace.whatsappPhoneNumberId;
  
  if (!accessToken || !phoneNumberId) {
    throw new Error('WABA credentials not configured for workspace');
  }

  try {
    const result = await metaService.sendTextMessage(accessToken, phoneNumberId, to, message.body);
    
    await Message.findByIdAndUpdate(messageId, { 
      status: 'sent', 
      $push: { 'meta.whatsappResponses': result },
      $set: { 'meta.whatsappId': result.messageId }
    });
    
    // Increment usage
    workspace.usage.messagesSent += 1;
    await workspace.save();
    
    return result;
  } catch (err) {
    await Message.findByIdAndUpdate(messageId, { 
      status: 'failed', 
      $push: { 'meta.errors': err.message } 
    });
    throw err; // allow BullMQ to handle retries/backoff
  }
}

const { checkWorkspaceRateLimit } = require('./rateLimiter');

// ✅ Process campaign message job with limit checks and idempotency
async function processCampaignMessage(job) {
  const { campaignId, contactId, campaignMessageId, templateId, variableMapping } = job.data;
  const Campaign = require('../models/Campaign');
  const Contact = require('../models/Contact');
  // ... existing code ...

  const CampaignMessage = require('../models/CampaignMessage');
  const Template = require('../models/Template');
  const { checkShouldPauseCampaign } = require('./campaignValidationService');
  
  const campaign = await Campaign.findById(campaignId).populate('workspace template');
  if (!campaign) throw new Error('Campaign not found');
  
  const contact = await Contact.findById(contactId);
  if (!contact) throw new Error('Contact not found');
  
  const workspace = await Workspace.findById(campaign.workspace);
  if (!workspace) throw new Error('Workspace not found');
  
  const template = await Template.findById(templateId);
  if (!template) throw new Error('Template not found');
  
  // ✅ Check if campaign should auto-pause
  const { shouldPause, reason } = await checkShouldPauseCampaign(campaign);
  if (shouldPause) {
    campaign.status = 'paused';
    campaign.pausedReason = reason;
    campaign.pausedAt = new Date();
    await campaign.save();
    throw new Error(`CAMPAIGN_AUTO_PAUSED: ${reason}`);
  }
  
  // Get credentials
  const accessToken = workspace.whatsappAccessToken;
  const phoneNumberId = workspace.whatsappPhoneNumberId;
  
  if (!accessToken || !phoneNumberId) {
    throw new Error('WABA credentials not configured');
  }
  
  // ✅ Get or create message record (idempotency)
  let message = await Message.findOne({ 
    workspace: workspace._id,
    contact: contactId,
    meta: { campaignId: campaign._id }
  });
  
  if (!message) {
    message = await Message.create({
      workspace: workspace._id,
      contact: contactId,
      direction: 'outbound',
      type: 'template',
      body: template.bodyText || template.name,
      status: 'queued',
      meta: { 
        campaignId: campaign._id,
        campaignMessageId: campaignMessageId,
        templateId: templateId
      }
    });
  }
  
  try {
    // ✅ Build template parameters using variable mapping
    let templateParams = [];
    if (variableMapping && Object.keys(variableMapping).length > 0) {
      templateParams = template.variables?.map(variable => {
        const contactField = variableMapping[variable];
        const value = contact[contactField] || contact.metadata?.[contactField] || '';
        return { type: 'text', text: String(value) };
      }) || [];
    }
    
    // ✅ Send template message via Meta API
    const result = await metaService.sendTemplateMessage(
      accessToken,
      phoneNumberId,
      contact.phone,
      template.name,
      'en',
      templateParams.length > 0 ? [{ type: 'body', parameters: templateParams }] : []
    );
    
    // ✅ Update Message
    message.status = 'sent';
    message.sentAt = new Date();
    message.meta.whatsappId = result.messageId;
    message.meta.whatsappResponses = [result];
    await message.save();
    
    // ✅ Update CampaignMessage (idempotency record)
    await CampaignMessage.findByIdAndUpdate(
      campaignMessageId,
      {
        status: 'sent',
        sentAt: new Date(),
        whatsappMessageId: result.messageId,
        message: message._id
      }
    );
    
    // ✅ Update Campaign stats atomically
    await Campaign.findByIdAndUpdate(
      campaignId,
      {
        $inc: { sentCount: 1 },
        $set: { updatedAt: new Date() }
      }
    );
    
    // ✅ Increment workspace usage atomically
    workspace.usage.messages = (workspace.usage.messages || 0) + 1;
    workspace.usage.messagesDaily = (workspace.usage.messagesDaily || 0) + 1;
    workspace.usage.messagesThisMonth = (workspace.usage.messagesThisMonth || 0) + 1;
    await workspace.save();
    
    return result;
  } catch (err) {
    // ✅ Handle specific Meta errors
    const errorMessage = err.message || '';
    
    // Check for token expiry
    if (errorMessage.includes('TOKEN_EXPIRED') || errorMessage.includes('401')) {
      campaign.status = 'paused';
      campaign.pausedReason = 'TOKEN_EXPIRED';
      campaign.pausedAt = new Date();
      await campaign.save();
      throw new Error('TOKEN_EXPIRED');
    }
    
    // Check for blocked account
    if (errorMessage.includes('ACCOUNT_BLOCKED') || errorMessage.includes('DISABLED')) {
      campaign.status = 'paused';
      campaign.pausedReason = 'ACCOUNT_BLOCKED';
      campaign.pausedAt = new Date();
      await campaign.save();
      throw new Error('ACCOUNT_BLOCKED');
    }
    
    // Update Message status
    message.status = 'failed';
    message.meta.errors = message.meta.errors || [];
    message.meta.errors.push(errorMessage);
    await message.save();
    
    // ✅ Update CampaignMessage status
    await CampaignMessage.findByIdAndUpdate(
      campaignMessageId,
      {
        status: 'failed',
        failedAt: new Date(),
        lastError: errorMessage,
        attempts: (await CampaignMessage.findById(campaignMessageId))?.attempts + 1
      }
    );
    
    // ✅ Update Campaign stats
    await Campaign.findByIdAndUpdate(
      campaignId,
      {
        $inc: { failedCount: 1 },
        $set: { updatedAt: new Date() }
      }
    );
    
    throw err; // Let BullMQ handle retries
  }
}

// ✅ Process batch of campaign contacts
async function processCampaignBatch(job) {
  // LEGACY PATH DISABLED
  // WHY: Campaign execution must use V2 engine (campaignWorkerService + campaignRateLimiter)
  throw new Error('LEGACY_CAMPAIGN_ENGINE_DISABLED');

  const { campaignId, contactIds, templateId, variableMapping, batchIndex } = job.data;
  const Campaign = require('../models/Campaign');
  const Contact = require('../models/Contact');
  const CampaignMessage = require('../models/CampaignMessage');
  const Template = require('../models/Template');
  
  const campaign = await Campaign.findById(campaignId).populate('workspace');
  if (!campaign || (campaign.status !== 'sending' && campaign.status !== 'queued')) {
    // Campaign paused or stopped - acknowledge job but don't send
    return { status: 'skipped', reason: 'Campaign not running' };
  }
  
  // Rate Limit Check (Per Workspace)
  const workspaceId = campaign.workspace._id.toString();
  const { checkWorkspaceRateLimit } = require('./rateLimiter');
  const rateLimitResponse = await checkWorkspaceRateLimit(workspaceId, 1000); // 1000 msg/min default
  
  if (!rateLimitResponse.allowed) {
    const delay = rateLimitResponse.retryAfter * 1000;
    // Throw error to retry later (BullMQ will use backoff)
    throw new Error(`RATE_LIMIT_EXCEEDED:${delay}`);
  }
  
  // Load Template & Workspace Details
  const template = await Template.findById(templateId);
  if (!template) throw new Error('Template not found');
  
  const workspace = await Workspace.findById(workspaceId);
  const accessToken = workspace.whatsappAccessToken;
  const phoneNumberId = workspace.whatsappPhoneNumberId;
  
  if (!accessToken || !phoneNumberId) throw new Error('WABA credentials missing');

  // Process contacts sequentially in the batch
  const results = [];
  
  for (const contactId of contactIds) {
    try {
      // 1. Idempotency Check & Record Creation
      let campaignMessage = await CampaignMessage.findOne({
          campaign: campaignId,
          contact: contactId
      });
      
      if (!campaignMessage) {
         campaignMessage = await CampaignMessage.create({
             workspace: workspaceId,
             campaign: campaignId,
             contact: contactId,
             status: 'queued'
         });
      }
      
      if (['sent', 'delivered', 'read', 'failed'].includes(campaignMessage.status)) {
         results.push({ contactId, status: 'already_processed' });
         continue; 
      }
      
      const contact = await Contact.findById(contactId);
      if (!contact) continue; // Skip if contact deleted
      
      // 2. Prepare Template Params
      let templateParams = [];
      if (variableMapping && Object.keys(variableMapping).length > 0) {
        templateParams = template.variables?.map(variable => {
          const contactField = variableMapping[variable];
          const value = contact[contactField] || contact.metadata?.[contactField] || '';
          return { type: 'text', text: String(value) };
        }) || [];
      }
      
      // 3. Send Message
      const result = await metaService.sendTemplateMessage(
        accessToken,
        phoneNumberId,
        contact.phone,
        template.name,
        template.language || 'en', 
        templateParams.length > 0 ? [{ type: 'body', parameters: templateParams }] : []
      );
      
      // 4. Update Success
      await CampaignMessage.findByIdAndUpdate(campaignMessage._id, {
          status: 'sent',
          sentAt: new Date(),
          whatsappMessageId: result.messageId
      });
      
      await Campaign.findByIdAndUpdate(campaignId, { $inc: { sentCount: 1 } });
      
      // Create Message record for consistency
      await Message.create({
         workspace: workspaceId,
         contact: contactId,
         direction: 'outbound',
         type: 'template',
         body: template.name,
         status: 'sent',
         meta: { campaignId, campaignMessageId: campaignMessage._id, whatsappId: result.messageId }
      });
      
      results.push({ contactId, status: 'sent', id: result.messageId });
    } catch (err) {
       console.error(`Failed to send to contact ${contactId}:`, err.message);
       // Update Failure
       await CampaignMessage.findOneAndUpdate(
           { campaign: campaignId, contact: contactId },
           { status: 'failed', failedAt: new Date(), lastError: err.message }
       );
       await Campaign.findByIdAndUpdate(campaignId, { $inc: { failedCount: 1 } });
       
       results.push({ contactId, status: 'failed', error: err.message });
       
       if (err.message.includes('(#80007)') || err.message.includes('429')) {
           throw err; // Stop batch and retry later
       }
    }
    
    // Tiny delay between messages in batch
    await new Promise(r => setTimeout(r, 50)); 
  }

  // Check for campaign completion
  const freshCampaign = await Campaign.findById(campaignId);
  const processed = (freshCampaign.sentCount || 0) + (freshCampaign.failedCount || 0);
  if (processed >= (freshCampaign.totalContacts || 0)) {
     await Campaign.findByIdAndUpdate(campaignId, { status: 'completed', completedAt: new Date() });
  }
  
  return { batchIndex, totalProcessed: results.length };
}

module.exports = { enqueueSend, processSendJob, processCampaignBatch };


