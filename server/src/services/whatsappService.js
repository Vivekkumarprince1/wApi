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

// Process campaign message job
async function processCampaignMessage(job) {
  const { campaignId, contactId, templateName, templateParams } = job.data;
  const Campaign = require('../models/Campaign');
  const Contact = require('../models/Contact');
  
  const campaign = await Campaign.findById(campaignId).populate('workspace');
  if (!campaign) throw new Error('Campaign not found');
  
  const contact = await Contact.findById(contactId);
  if (!contact) throw new Error('Contact not found');
  
  const workspace = await Workspace.findById(campaign.workspace);
  if (!workspace) throw new Error('Workspace not found');
  
  // Get credentials
  const accessToken = workspace.whatsappAccessToken;
  const phoneNumberId = workspace.whatsappPhoneNumberId;
  
  if (!accessToken || !phoneNumberId) {
    throw new Error('WABA credentials not configured');
  }
  
  // Create message record
  const message = await Message.create({
    workspace: workspace._id,
    contact: contactId,
    direction: 'outbound',
    type: templateName ? 'template' : 'text',
    body: campaign.message,
    status: 'queued',
    meta: { campaignId }
  });
  
  try {
    let result;
    if (templateName) {
      result = await metaService.sendTemplateMessage(
        accessToken, 
        phoneNumberId, 
        contact.phone, 
        templateName,
        'en',
        templateParams || []
      );
    } else {
      // Replace variables in campaign message
      let personalizedMessage = campaign.message;
      personalizedMessage = personalizedMessage.replace(/\{\{name\}\}/g, contact.name || '');
      personalizedMessage = personalizedMessage.replace(/\{\{phone\}\}/g, contact.phone || '');
      personalizedMessage = personalizedMessage.replace(/\{\{email\}\}/g, contact.email || '');
      
      result = await metaService.sendTextMessage(accessToken, phoneNumberId, contact.phone, personalizedMessage);
    }
    
    message.status = 'sent';
    message.meta.whatsappId = result.messageId;
    message.meta.whatsappResponses = [result];
    await message.save();
    
    // Update campaign stats
    campaign.sentCount = (campaign.sentCount || 0) + 1;
    await campaign.save();
    
    // Increment usage
    workspace.usage.messagesSent += 1;
    await workspace.save();
    
    return result;
  } catch (err) {
    message.status = 'failed';
    message.meta.errors = [err.message];
    await message.save();
    
    campaign.failedCount = (campaign.failedCount || 0) + 1;
    await campaign.save();
    
    throw err;
  }
}

module.exports = { enqueueSend, processSendJob };
