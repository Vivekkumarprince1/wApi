const Campaign = require('../models/Campaign');
const { createQueue } = require('../services/queue');
const sendQueue = createQueue('whatsapp-sends');

async function createCampaign(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const payload = { workspace, ...req.body };
    const campaign = await Campaign.create(payload);
    res.status(201).json({ campaign });
  } catch (err) { next(err); }
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
    
    // Only allow deletion of draft or completed campaigns
    if (campaign.status === 'running') {
      return res.status(400).json({ 
        message: 'Cannot delete running campaign. Please pause it first.' 
      });
    }
    
    await Campaign.deleteOne({ _id: req.params.id });
    res.json({ success: true, message: 'Campaign deleted' });
  } catch (err) { next(err); }
}

async function getCampaignStats(req, res, next) {
  try {
    const workspace = req.user.workspace;
    
    const totalCampaigns = await Campaign.countDocuments({ workspace });
    const runningCampaigns = await Campaign.countDocuments({ workspace, status: 'running' });
    const completedCampaigns = await Campaign.countDocuments({ workspace, status: 'completed' });
    const draftCampaigns = await Campaign.countDocuments({ workspace, status: 'draft' });
    
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
      runningCampaigns,
      completedCampaigns,
      draftCampaigns,
      successRate
    });
  } catch (err) { next(err); }
}

async function enqueueCampaign(req, res, next) {
  try {
    const campaign = await Campaign.findById(req.params.id).populate('contacts');
    if (!campaign) return res.status(404).json({ message: 'Not found' });
    
    // Enqueue messages for each contact
    const contactIds = campaign.contacts.map(c => c._id);
    
    for (const contactId of contactIds) {
      await sendQueue.add(
        'send', 
        { 
          campaignId: campaign._id, 
          contactId,
          templateName: req.body.templateName,
          templateParams: req.body.templateParams
        },
        {
          jobId: `campaign:${campaign._id}:contact:${contactId}`,
          attempts: 5,
          backoff: { type: 'exponential', delay: 2000 }
        }
      );
    }
    
    campaign.status = 'running';
    campaign.totalContacts = contactIds.length;
    await campaign.save();
    
    res.json({ success: true, enqueuedCount: contactIds.length });
  } catch (err) { next(err); }
}

module.exports = { 
  createCampaign, 
  listCampaigns,
  getCampaign,
  updateCampaign,
  deleteCampaign,
  getCampaignStats,
  enqueueCampaign 
};
