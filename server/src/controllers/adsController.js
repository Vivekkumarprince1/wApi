const WhatsAppAd = require('../models/WhatsAppAd');
const Workspace = require('../models/Workspace');
const adsValidationService = require('../services/adsValidationService');
const metaAdsService = require('../services/metaAdsService');

/**
 * ✅ Check ads prerequisites & return if enabled
 */
exports.checkAdsEligibility = async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.user.workspace);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const result = await adsValidationService.validateAdsPrerequisites(workspace);
    
    res.json({
      enabled: result.enabled,
      plan: workspace.plan,
      checks: result.checks,
      errors: result.errors,
      limits: adsValidationService.ADS_PLAN_LIMITS[workspace.plan]
    });
  } catch (err) {
    console.error('Error checking ads eligibility:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * ✅ Create new ad campaign
 */
exports.createAd = async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.user.workspace);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const { name, objective, budget, currency, scheduleStart, scheduleEnd, 
            targeting, template, templateVariableMapping, welcomeMessage, ctaText } = req.body;

    // ✅ Validate input
    if (!name || !budget || !scheduleStart || !template) {
      return res.status(400).json({ 
        error: 'Missing required fields: name, budget, scheduleStart, template' 
      });
    }

    // ✅ Validate prerequisites
    await adsValidationService.validateAdsCreation(workspace, {
      name,
      objective,
      budget,
      scheduleStart,
      scheduleEnd,
      targeting,
      template
    });

    // ✅ Get phone number ID
    const phoneNumberId = workspace.esbFlow?.phoneNumberIdForOTP || workspace.whatsappPhoneNumber;
    if (!phoneNumberId) {
      return res.status(400).json({ error: 'Phone number not configured' });
    }

    // ✅ Create ad document (draft status)
    const ad = new WhatsAppAd({
      workspace: workspace._id,
      name,
      objective: objective || 'MESSAGES',
      budget,
      currency: currency || 'USD',
      scheduleStart,
      scheduleEnd,
      targeting: targeting || {},
      template,
      templateVariableMapping: templateVariableMapping || {},
      welcomeMessage: welcomeMessage || 'Message us on WhatsApp',
      phoneNumberId,
      ctaText: ctaText || 'Message us',
      status: 'draft',
      createdBy: req.user._id
    });

    // ✅ Create in Meta Ads API
    console.log(`🚀 [Ads] Creating ad in Meta...`);
    const metaIds = await metaAdsService.createAdCampaign(workspace, ad);

    // ✅ Update with Meta IDs
    ad.metaCampaignId = metaIds.campaignId;
    ad.metaAdSetId = metaIds.adSetId;
    ad.metaAdCreativeId = metaIds.creativeId;
    ad.metaAdId = metaIds.adId;
    ad.status = 'pending_review'; // Meta review pending
    ad.metaStatus = 'PENDING_REVIEW';

    await ad.save();

    // ✅ Log success
    console.log(`✅ [Ads] Ad created successfully: ${ad._id}`);

    res.status(201).json({
      success: true,
      ad: ad.toObject(),
      message: 'Ad created and submitted for review'
    });
  } catch (err) {
    console.error('❌ [Ads] Error creating ad:', err);
    res.status(400).json({ error: err.message });
  }
};

/**
 * ✅ List all ads for workspace
 */
exports.listAds = async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.user.workspace);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const { status, page = 1, limit = 20 } = req.query;

    let query = { workspace: workspace._id };
    if (status) {
      query.status = status;
    }

    const ads = await WhatsAppAd.find(query)
      .populate('template', 'name status category')
      .populate('createdBy', 'email name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await WhatsAppAd.countDocuments(query);

    res.json({
      ads,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Error listing ads:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * ✅ Get single ad
 */
exports.getAd = async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.user.workspace);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const ad = await WhatsAppAd.findOne({
      _id: req.params.id,
      workspace: workspace._id
    }).populate('template').populate('createdBy', 'email name');

    if (!ad) {
      return res.status(404).json({ error: 'Ad not found' });
    }

    res.json({ ad });
  } catch (err) {
    console.error('Error getting ad:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * ✅ Update ad (only draft status)
 */
exports.updateAd = async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.user.workspace);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const ad = await WhatsAppAd.findOne({
      _id: req.params.id,
      workspace: workspace._id
    });

    if (!ad) {
      return res.status(404).json({ error: 'Ad not found' });
    }

    // Can only edit draft ads
    if (ad.status !== 'draft') {
      return res.status(400).json({ 
        error: 'Can only edit ads in draft status' 
      });
    }

    // Update allowed fields
    const { name, budget, targeting, welcomeMessage, ctaText } = req.body;

    if (name) ad.name = name;
    if (budget) ad.budget = budget;
    if (targeting) ad.targeting = targeting;
    if (welcomeMessage) ad.welcomeMessage = welcomeMessage;
    if (ctaText) ad.ctaText = ctaText;

    await ad.save();

    res.json({
      success: true,
      ad: ad.toObject(),
      message: 'Ad updated'
    });
  } catch (err) {
    console.error('Error updating ad:', err);
    res.status(400).json({ error: err.message });
  }
};

/**
 * ✅ Pause ad (auto-pause or manual pause)
 */
exports.pauseAd = async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.user.workspace);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const ad = await WhatsAppAd.findOne({
      _id: req.params.id,
      workspace: workspace._id
    });

    if (!ad) {
      return res.status(404).json({ error: 'Ad not found' });
    }

    if (ad.status === 'paused') {
      return res.status(400).json({ error: 'Ad is already paused' });
    }

    // Pause in Meta
    if (ad.metaAdId) {
      await metaAdsService.pauseAdInMeta(ad, workspace);
    }

    // Update locally
    ad.status = 'paused';
    ad.metaStatus = 'PAUSED';
    ad.pausedAt = new Date();
    ad.pausedBy = req.user._id;
    ad.pausedReason = req.body.reason || 'MANUAL_PAUSE';

    await ad.save();

    console.log(`✅ [Ads] Paused ad: ${ad._id}`);

    res.json({
      success: true,
      ad: ad.toObject(),
      message: 'Ad paused'
    });
  } catch (err) {
    console.error('Error pausing ad:', err);
    res.status(400).json({ error: err.message });
  }
};

/**
 * ✅ Resume ad
 */
exports.resumeAd = async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.user.workspace);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const ad = await WhatsAppAd.findOne({
      _id: req.params.id,
      workspace: workspace._id
    });

    if (!ad) {
      return res.status(404).json({ error: 'Ad not found' });
    }

    if (ad.status !== 'paused') {
      return res.status(400).json({ error: 'Can only resume paused ads' });
    }

    // Check if can resume
    const pauseCheck = await adsValidationService.checkShouldPauseAd(workspace, ad);
    if (pauseCheck.shouldPause) {
      return res.status(400).json({ 
        error: `Cannot resume: ${pauseCheck.reason}`,
        reason: pauseCheck.reason,
        checks: pauseCheck.checks
      });
    }

    // Resume in Meta
    if (ad.metaAdId) {
      await metaAdsService.resumeAdInMeta(ad, workspace);
    }

    // Update locally
    ad.status = 'active';
    ad.metaStatus = 'ACTIVE';
    ad.pausedAt = null;
    ad.pausedReason = null;
    ad.pausedBy = null;

    await ad.save();

    console.log(`✅ [Ads] Resumed ad: ${ad._id}`);

    res.json({
      success: true,
      ad: ad.toObject(),
      message: 'Ad resumed'
    });
  } catch (err) {
    console.error('Error resuming ad:', err);
    res.status(400).json({ error: err.message });
  }
};

/**
 * ✅ Delete ad
 */
exports.deleteAd = async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.user.workspace);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const ad = await WhatsAppAd.findOne({
      _id: req.params.id,
      workspace: workspace._id
    });

    if (!ad) {
      return res.status(404).json({ error: 'Ad not found' });
    }

    // Delete from Meta if exists
    if (ad.metaAdId) {
      await metaAdsService.deleteAdInMeta(ad, workspace);
    }

    // Delete locally
    await WhatsAppAd.deleteOne({ _id: ad._id });

    console.log(`✅ [Ads] Deleted ad: ${ad._id}`);

    res.json({
      success: true,
      message: 'Ad deleted'
    });
  } catch (err) {
    console.error('Error deleting ad:', err);
    res.status(400).json({ error: err.message });
  }
};

/**
 * ✅ Get ad analytics
 */
exports.getAdAnalytics = async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.user.workspace);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const ad = await WhatsAppAd.findOne({
      _id: req.params.id,
      workspace: workspace._id
    });

    if (!ad) {
      return res.status(404).json({ error: 'Ad not found' });
    }

    res.json({
      ad: {
        name: ad.name,
        status: ad.status,
        budget: ad.budget,
        spent: ad.spentAmount,
        impressions: ad.impressions,
        clicks: ad.clicks,
        conversions: ad.conversions,
        ctr: ad.ctr,
        cpc: ad.cpc,
        createdAt: ad.createdAt
      }
    });
  } catch (err) {
    console.error('Error getting ad analytics:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * ✅ Auto-pause ads if conditions fail (called by background job)
 */
exports.autoPauseAdsByWorkspace = async (workspaceId) => {
  try {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) return;

    const activeAds = await WhatsAppAd.find({
      workspace: workspaceId,
      status: 'active'
    });

    console.log(`🔍 [Ads] Checking ${activeAds.length} active ads for auto-pause...`);

    for (const ad of activeAds) {
      const pauseCheck = await adsValidationService.checkShouldPauseAd(workspace, ad);
      
      if (pauseCheck.shouldPause) {
        console.log(`⏸️ [Ads] Auto-pausing ad: ${ad._id} - Reason: ${pauseCheck.reason}`);
        
        // Pause in Meta
        await metaAdsService.pauseAdInMeta(ad, workspace);
        
        // Update locally
        ad.status = 'paused';
        ad.pausedReason = pauseCheck.reason;
        ad.pausedAt = new Date();
        await ad.save();
      }
    }
  } catch (err) {
    console.error('❌ [Ads] Error auto-pausing ads:', err.message);
  }
};

module.exports = exports;
