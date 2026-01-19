const Campaign = require('../models/Campaign');
const CampaignMessage = require('../models/CampaignMessage');
const Message = require('../models/Message');
const Workspace = require('../models/Workspace');
const Template = require('../models/Template');
const Contact = require('../models/Contact');
const { createQueue } = require('../services/queue');
const { validateCampaignCreation, validateCampaignStart, checkShouldPauseCampaign } = require('../services/campaignValidationService');

const sendQueue = createQueue('whatsapp-sends');

// ✅ Create campaign with full validation (Interakt-style)
async function createCampaign(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const workspace = await Workspace.findById(workspaceId);
    
    // ✅ Validate campaign BEFORE creation
    await validateCampaignCreation(workspace, req.body);
    
    const payload = {
      workspace: workspaceId,
      ...req.body,
      createdBy: req.user._id,
      status: 'draft' // Start as draft
    };
    
    const campaign = await Campaign.create(payload);
    
    // Populate template and contacts
    const campaignData = await Campaign.findById(campaign._id)
      .populate('template', 'name variables status')
      .populate('contacts', 'phone name');
    
    res.status(201).json({ 
      campaign: campaignData,
      message: 'Campaign created successfully. Ready to send.'
    });
  } catch (err) {
    // Return validation error with proper message
    const errorMessage = err.message;
    if (errorMessage.includes('TEMPLATE_NOT_APPROVED')) {
      return res.status(400).json({ code: 'TEMPLATE_NOT_APPROVED', message: 'Template must be APPROVED by Meta before use' });
    }
    if (errorMessage.includes('ACCOUNT_BLOCKED')) {
      return res.status(403).json({ code: 'ACCOUNT_BLOCKED', message: 'Your WhatsApp account is blocked' });
    }
    if (errorMessage.includes('TOKEN_EXPIRED')) {
      return res.status(403).json({ code: 'TOKEN_EXPIRED', message: 'WhatsApp connection expired. Please reconnect.' });
    }
    if (errorMessage.includes('DAILY_LIMIT_EXCEEDED')) {
      return res.status(429).json({ code: 'DAILY_LIMIT_EXCEEDED', message: errorMessage });
    }
    if (errorMessage.includes('MONTHLY_LIMIT_EXCEEDED')) {
      return res.status(429).json({ code: 'MONTHLY_LIMIT_EXCEEDED', message: errorMessage });
    }
    next(err);
  }
}

async function listCampaigns(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const { status, page = 1, limit = 10 } = req.query;
    
    const query = { workspace };
    if (status) query.status = status;
    
    const total = await Campaign.countDocuments(query);
    const campaigns = await Campaign.find(query)
      .populate('template', 'name')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    res.json({
      campaigns,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit)
      }
    });
  } catch (err) { next(err); }
}

async function getCampaign(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const campaign = await Campaign.findOne({ _id: req.params.id, workspace })
      .populate('template contacts');
    
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    res.json({ campaign });
  } catch (err) { next(err); }
}

async function updateCampaign(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const campaign = await Campaign.findOneAndUpdate(
      { _id: req.params.id, workspace },
      req.body,
      { new: true }
    );
    
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    res.json({ campaign });
  } catch (err) { next(err); }
}

async function deleteCampaign(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const campaign = await Campaign.findOne({ _id: req.params.id, workspace });
    
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    // ✅ Only allow deletion of draft or completed campaigns
    if (['queued', 'sending'].includes(campaign.status)) {
      return res.status(400).json({ 
        message: 'Cannot delete running campaign. Please pause it first.',
        code: 'CAMPAIGN_RUNNING'
      });
    }
    
    // Delete associated campaign messages
    await CampaignMessage.deleteMany({ campaign: campaign._id });
    
    await Campaign.deleteOne({ _id: req.params.id });
    res.json({ success: true, message: 'Campaign deleted' });
  } catch (err) { next(err); }
}

async function getCampaignStats(req, res, next) {
  try {
    const workspace = req.user.workspace;
    
    const totalCampaigns = await Campaign.countDocuments({ workspace });
    const sendingCampaigns = await Campaign.countDocuments({ workspace, status: 'sending' });
    const completedCampaigns = await Campaign.countDocuments({ workspace, status: 'completed' });
    const draftCampaigns = await Campaign.countDocuments({ workspace, status: 'draft' });
    const pausedCampaigns = await Campaign.countDocuments({ workspace, status: 'paused' });
    
    // Calculate success rate
    const campaigns = await Campaign.find({ workspace, status: 'completed' });
    let totalSent = 0;
    let totalSuccess = 0;
    
    campaigns.forEach(campaign => {
      totalSent += campaign.totalContacts || 0;
      totalSuccess += campaign.sentCount || 0;
    });
    
    const successRate = totalSent > 0 ? Math.round((totalSuccess / totalSent) * 100) : 0;
    
    res.json({
      totalCampaigns,
      sendingCampaigns,
      completedCampaigns,
      pausedCampaigns,
      draftCampaigns,
      successRate,
      totalMessages: totalSent,
      successfulMessages: totalSuccess
    });
  } catch (err) { next(err); }
}

// ✅ Start campaign execution (queues messages via BullMQ worker)
async function enqueueCampaign(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const campaign = await Campaign.findOne({ _id: req.params.id, workspace: workspaceId })
      .populate('template contacts');
    
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    // ✅ Re-validate before starting
    const validation = await validateCampaignStart(campaign);
    if (!validation.valid) {
      return res.status(400).json({
        code: validation.reason,
        message: validation.message
      });
    }
    
    // ✅ Update campaign status to queued
    campaign.status = 'queued';
    campaign.totalContacts = campaign.contacts.length;
    campaign.startedAt = new Date();
    await campaign.save();
    
    // ✅ Chunk contacts into batches for efficient processing
    const BATCH_SIZE = 50;
    const contactChunks = [];
    
    for (let i = 0; i < campaign.contacts.length; i += BATCH_SIZE) {
      contactChunks.push(campaign.contacts.slice(i, i + BATCH_SIZE));
    }
    
    // Queue batch jobs
    const jobPromises = contactChunks.map(async (chunk, index) => {
      // Create message records in bulk for this chunk (slower but ensures ID tracking)
      // Optimally, this happens inside the worker or via bulkWrite, but for visibility we create placeholders
      // We skip detailed placeholder creation here to save time and do it in worker or just rely on logs.
      // However, Interakt usually creates "Waiting" logs visible in UI. 
      // Let's create a minimal record or pass the responsibility to the worker to creating them. 
      // To prevent strict UI requirements breaking, we will pass contact IDs to the worker.
      
      return sendQueue.add(
        'campaign-batch',
        {
          campaignId: campaign._id,
          contactIds: chunk.map(c => c._id),
          templateId: campaign.template._id,
          variableMapping: campaign.variableMapping || {},
          batchIndex: index,
          totalBatches: contactChunks.length
        },
        {
          jobId: `campaign:${campaign._id}:batch:${index}`,
          priority: 1, // Normal priority
          removeOnComplete: true
        }
      );
    });
    
    await Promise.all(jobPromises);
    
    // ✅ Update campaign to "sending"
    campaign.status = 'sending';
    await campaign.save();
    
    res.json({
      success: true,
      campaignId: campaign._id,
      message: `Campaign queued: ${contactChunks.length} batches created for ${campaign.contacts.length} contacts`,
      enqueuedCount: campaign.contacts.length,
      status: 'sending'
    });
  } catch (err) { next(err); }
}

// ✅ Pause campaign (e.g., due to limits or auto-pause)
async function pauseCampaign(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { reason, pauseReason } = req.body; // Support both keys
    
    const campaign = await Campaign.findOne({ _id: req.params.id, workspace: workspaceId });
    
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    if (campaign.status === 'paused') {
      return res.status(400).json({ message: 'Campaign is already paused' });
    }
    
    campaign.status = 'paused';
    campaign.pausedReason = reason || pauseReason || 'USER_PAUSED';
    campaign.pausedAt = new Date();
    await campaign.save();
    
    res.json({
      success: true,
      message: 'Campaign paused',
      campaign
    });
  } catch (err) { next(err); }
}

// ✅ Resume campaign
async function resumeCampaign(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const campaign = await Campaign.findOne({ _id: req.params.id, workspace: workspaceId })
      .populate('template contacts');
    
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    if (campaign.status !== 'paused') {
      return res.status(400).json({ message: 'Only paused campaigns can be resumed' });
    }
    
    // ✅ Validate before resume
    const validation = await validateCampaignStart(campaign);
    if (!validation.valid) {
      return res.status(400).json({
        code: validation.reason,
        message: validation.message
      });
    }
    
    // Get unsentmessages
    const unsentMessages = await CampaignMessage.find({
      campaign: campaign._id,
      status: 'queued'
    });
    
    if (unsentMessages.length === 0) {
      return res.status(400).json({ message: 'All messages have been sent' });
    }
    
    // Re-enqueue unsent messages
    for (const msg of unsentMessages) {
      await sendQueue.add(
        'send',
        {
          campaignId: campaign._id,
          contactId: msg.contact,
          campaignMessageId: msg._id,
          templateId: campaign.template._id,
          variableMapping: campaign.variableMapping || {}
        },
        {
          jobId: `campaign:${campaign._id}:contact:${msg.contact}`,
          attempts: 5,
          backoff: { type: 'exponential', delay: 2000 }
        }
      );
    }
    
    campaign.status = 'sending';
    campaign.pausedReason = null;
    campaign.pausedAt = null;
    await campaign.save();
    
    res.json({
      success: true,
      message: `Campaign resumed: ${unsentMessages.length} unsent messages re-queued`,
      campaign
    });
  } catch (err) { next(err); }
}

module.exports = {
  createCampaign,
  listCampaigns,
  getCampaign,
  updateCampaign,
  deleteCampaign,
  getCampaignStats,
  enqueueCampaign,
  pauseCampaign,
  resumeCampaign
};
