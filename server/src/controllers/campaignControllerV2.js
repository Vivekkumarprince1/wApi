const Campaign = require('../models/Campaign');
const CampaignBatch = require('../models/CampaignBatch');
const CampaignMessage = require('../models/CampaignMessage');
const Template = require('../models/Template');
const Contact = require('../models/Contact');
const Workspace = require('../models/Workspace');
const campaignExecutionService = require('../services/campaignExecutionService');
const { validateCampaignCreation, validateCampaignStart, checkShouldPauseCampaign } = require('../services/campaignValidationService');

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * CAMPAIGN CONTROLLER - Stage 3 Implementation
 * 
 * REST API endpoints for campaign management following Interakt's architecture:
 * - Full CRUD operations
 * - Campaign lifecycle (start, pause, resume)
 * - Progress tracking
 * - Message listing
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ─────────────────────────────────────────────────────────────────────────────
// CREATE CAMPAIGN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new campaign
 * POST /api/campaigns
 */
async function createCampaign(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const userId = req.user._id;
    
    const campaign = await campaignExecutionService.createCampaign(
      workspaceId,
      req.body,
      userId
    );
    
    // Populate response
    const populatedCampaign = await Campaign.findById(campaign._id)
      .populate('template', 'name category status variables')
      .populate('createdBy', 'email name');
    
    res.status(201).json({
      success: true,
      campaign: populatedCampaign,
      message: 'Campaign created successfully'
    });
  } catch (err) {
    handleCampaignError(err, res, next);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LIST CAMPAIGNS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * List campaigns with pagination
 * GET /api/campaigns
 */
async function listCampaigns(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { 
      status, 
      page = 1, 
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search
    } = req.query;
    
    const query = { workspace: workspaceId };
    
    // Filter by status
    if (status) {
      // Handle both old and new status formats
      const statusMap = {
        'draft': ['DRAFT', 'draft'],
        'scheduled': ['SCHEDULED', 'queued'],
        'running': ['RUNNING', 'sending'],
        'paused': ['PAUSED', 'paused'],
        'completed': ['COMPLETED', 'completed'],
        'failed': ['FAILED', 'failed']
      };
      
      if (statusMap[status.toLowerCase()]) {
        query.status = { $in: statusMap[status.toLowerCase()] };
      } else {
        query.status = status;
      }
    }
    
    // Search by name
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }
    
    // Build sort
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
    
    const total = await Campaign.countDocuments(query);
    
    const campaigns = await Campaign.find(query)
      .populate('template', 'name category status')
      .populate('createdBy', 'email name')
      .sort(sort)
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();
    
    // Enrich with progress data
    const enrichedCampaigns = campaigns.map(campaign => ({
      ...campaign,
      progress: calculateProgress(campaign),
      rates: calculateRates(campaign)
    }));
    
    res.json({
      success: true,
      campaigns: enrichedCampaigns,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET SINGLE CAMPAIGN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get campaign details
 * GET /api/campaigns/:id
 */
async function getCampaign(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const campaignId = req.params.id;
    
    const campaign = await Campaign.findOne({ _id: campaignId, workspace: workspaceId })
      .populate('template', 'name category status variables language headerType bodyText')
      .populate('contacts', 'phone name')
      .populate('createdBy', 'email name')
      .lean();
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        code: 'CAMPAIGN_NOT_FOUND',
        message: 'Campaign not found'
      });
    }
    
    // Get batch progress if running
    let batchProgress = null;
    if (['RUNNING', 'sending', 'PAUSED', 'paused'].includes(campaign.status)) {
      batchProgress = await CampaignBatch.getCampaignBatchStats(campaignId);
    }
    
    res.json({
      success: true,
      campaign: {
        ...campaign,
        progress: calculateProgress(campaign),
        rates: calculateRates(campaign),
        batchProgress
      }
    });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE CAMPAIGN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Update campaign (only draft campaigns)
 * PUT /api/campaigns/:id
 */
async function updateCampaign(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const campaignId = req.params.id;
    
    const campaign = await Campaign.findOne({ _id: campaignId, workspace: workspaceId });
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        code: 'CAMPAIGN_NOT_FOUND',
        message: 'Campaign not found'
      });
    }
    
    // Only allow updates to draft campaigns
    if (!['DRAFT', 'draft', 'SCHEDULED'].includes(campaign.status)) {
      return res.status(400).json({
        success: false,
        code: 'CAMPAIGN_NOT_EDITABLE',
        message: 'Only draft or scheduled campaigns can be edited'
      });
    }
    
    // Allowed update fields
    const allowedFields = [
      'name', 'description', 'template', 'variableMapping',
      'contacts', 'recipientFilter', 'scheduledAt'
    ];
    
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }
    
    // If template changes, validate it
    if (updates.template) {
      const template = await Template.findOne({
        _id: updates.template,
        workspace: workspaceId
      });
      
      if (!template || template.status !== 'APPROVED') {
        return res.status(400).json({
          success: false,
          code: 'TEMPLATE_NOT_APPROVED',
          message: 'Template must be approved'
        });
      }
      
      // Update template snapshot
      updates.templateSnapshot = {
        name: template.name,
        category: template.category,
        language: template.language || 'en',
        variables: template.variables || [],
        headerType: template.headerType,
        bodyText: template.bodyText
      };
    }
    
    // Update recipient count if contacts change
    if (updates.contacts) {
      updates.totalContacts = updates.contacts.length;
      updates['totals.totalRecipients'] = updates.contacts.length;
    }
    
    const updatedCampaign = await Campaign.findByIdAndUpdate(
      campaignId,
      { $set: updates },
      { new: true }
    ).populate('template', 'name category status');
    
    res.json({
      success: true,
      campaign: updatedCampaign,
      message: 'Campaign updated successfully'
    });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE CAMPAIGN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Delete campaign
 * DELETE /api/campaigns/:id
 */
async function deleteCampaign(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const campaignId = req.params.id;
    
    const campaign = await Campaign.findOne({ _id: campaignId, workspace: workspaceId });
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        code: 'CAMPAIGN_NOT_FOUND',
        message: 'Campaign not found'
      });
    }
    
    // Prevent deletion of running campaigns
    if (['RUNNING', 'sending', 'queued'].includes(campaign.status)) {
      return res.status(400).json({
        success: false,
        code: 'CAMPAIGN_RUNNING',
        message: 'Cannot delete a running campaign. Please pause it first.'
      });
    }
    
    // Delete related records
    await Promise.all([
      CampaignBatch.deleteMany({ campaign: campaignId }),
      CampaignMessage.deleteMany({ campaign: campaignId }),
      Campaign.deleteOne({ _id: campaignId })
    ]);
    
    res.json({
      success: true,
      message: 'Campaign deleted successfully'
    });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CAMPAIGN STATS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get campaign statistics
 * GET /api/campaigns/stats
 */
async function getCampaignStats(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    
    // Count by status
    const statusCounts = await Campaign.aggregate([
      { $match: { workspace: workspaceId } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    const statusMap = statusCounts.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});
    
    // Calculate totals from completed campaigns
    const totals = await Campaign.aggregate([
      { 
        $match: { 
          workspace: workspaceId,
          status: { $in: ['COMPLETED', 'completed'] }
        }
      },
      {
        $group: {
          _id: null,
          totalSent: { $sum: { $ifNull: ['$totals.sent', '$sentCount'] } },
          totalDelivered: { $sum: { $ifNull: ['$totals.delivered', '$deliveredCount'] } },
          totalRead: { $sum: { $ifNull: ['$totals.read', '$readCount'] } },
          totalFailed: { $sum: { $ifNull: ['$totals.failed', '$failedCount'] } },
          totalRecipients: { $sum: { $ifNull: ['$totals.totalRecipients', '$totalContacts'] } }
        }
      }
    ]);
    
    const t = totals[0] || { totalSent: 0, totalDelivered: 0, totalRead: 0, totalFailed: 0, totalRecipients: 0 };
    
    res.json({
      success: true,
      stats: {
        total: await Campaign.countDocuments({ workspace: workspaceId }),
        draft: (statusMap['DRAFT'] || 0) + (statusMap['draft'] || 0),
        scheduled: (statusMap['SCHEDULED'] || 0) + (statusMap['queued'] || 0),
        running: (statusMap['RUNNING'] || 0) + (statusMap['sending'] || 0),
        paused: (statusMap['PAUSED'] || 0) + (statusMap['paused'] || 0),
        completed: (statusMap['COMPLETED'] || 0) + (statusMap['completed'] || 0),
        failed: (statusMap['FAILED'] || 0) + (statusMap['failed'] || 0)
      },
      totals: {
        sent: t.totalSent,
        delivered: t.totalDelivered,
        read: t.totalRead,
        failed: t.totalFailed,
        recipients: t.totalRecipients
      },
      rates: {
        deliveryRate: t.totalSent > 0 ? Math.round((t.totalDelivered / t.totalSent) * 100) : 0,
        readRate: t.totalDelivered > 0 ? Math.round((t.totalRead / t.totalDelivered) * 100) : 0,
        failureRate: t.totalRecipients > 0 ? Math.round((t.totalFailed / t.totalRecipients) * 100) : 0
      }
    });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CAMPAIGN LIFECYCLE: START
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Start campaign execution
 * POST /api/campaigns/:id/start
 */
async function startCampaign(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const campaignId = req.params.id;
    const userId = req.user._id;
    
    const result = await campaignExecutionService.startCampaign(
      campaignId,
      workspaceId,
      userId
    );
    
    res.json({
      success: true,
      campaign: result.campaign,
      jobId: result.jobId,
      message: result.message
    });
  } catch (err) {
    handleCampaignError(err, res, next);
  }
}

/**
 * Alias for start - enqueue campaign
 * POST /api/campaigns/:id/enqueue
 */
async function enqueueCampaign(req, res, next) {
  return startCampaign(req, res, next);
}

// ─────────────────────────────────────────────────────────────────────────────
// CAMPAIGN LIFECYCLE: PAUSE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pause campaign execution
 * POST /api/campaigns/:id/pause
 */
async function pauseCampaign(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const campaignId = req.params.id;
    const userId = req.user._id;
    const { reason } = req.body;
    
    const result = await campaignExecutionService.pauseCampaign(
      campaignId,
      workspaceId,
      userId,
      reason || 'USER_PAUSED'
    );
    
    res.json({
      success: true,
      campaign: result.campaign,
      removedJobs: result.removedJobs,
      message: result.message
    });
  } catch (err) {
    handleCampaignError(err, res, next);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CAMPAIGN LIFECYCLE: RESUME
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resume paused campaign
 * POST /api/campaigns/:id/resume
 */
async function resumeCampaign(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const campaignId = req.params.id;
    const userId = req.user._id;
    
    const result = await campaignExecutionService.resumeCampaign(
      campaignId,
      workspaceId,
      userId
    );
    
    res.json({
      success: true,
      campaign: result.campaign,
      resumedBatches: result.resumedBatches,
      message: result.message
    });
  } catch (err) {
    handleCampaignError(err, res, next);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CAMPAIGN PROGRESS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get campaign progress
 * GET /api/campaigns/:id/progress
 */
async function getCampaignProgress(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const campaignId = req.params.id;
    
    const progress = await campaignExecutionService.getCampaignProgress(
      campaignId,
      workspaceId
    );
    
    res.json({
      success: true,
      ...progress
    });
  } catch (err) {
    handleCampaignError(err, res, next);
  }
}

/**
 * Get campaign summary
 * GET /api/campaigns/:id/summary
 */
async function getCampaignSummary(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const campaignId = req.params.id;
    
    const summary = await campaignExecutionService.getCampaignSummary(
      campaignId,
      workspaceId
    );
    
    res.json({
      success: true,
      ...summary
    });
  } catch (err) {
    handleCampaignError(err, res, next);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CAMPAIGN MESSAGES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get campaign messages
 * GET /api/campaigns/:id/messages
 */
async function getCampaignMessages(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const campaignId = req.params.id;
    const { page, limit, status, search } = req.query;
    
    const result = await campaignExecutionService.getCampaignMessages(
      campaignId,
      workspaceId,
      { page: parseInt(page) || 1, limit: parseInt(limit) || 50, status, search }
    );
    
    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    handleCampaignError(err, res, next);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate progress percentage
 */
function calculateProgress(campaign) {
  const total = campaign.totals?.totalRecipients || campaign.totalContacts || 0;
  if (total === 0) return 0;
  
  const processed = (campaign.totals?.sent || campaign.sentCount || 0) + 
                   (campaign.totals?.failed || campaign.failedCount || 0);
  
  return Math.round((processed / total) * 100);
}

/**
 * Calculate delivery rates
 */
function calculateRates(campaign) {
  const sent = campaign.totals?.sent || campaign.sentCount || 0;
  const delivered = campaign.totals?.delivered || campaign.deliveredCount || 0;
  const read = campaign.totals?.read || campaign.readCount || 0;
  const failed = campaign.totals?.failed || campaign.failedCount || 0;
  
  return {
    deliveryRate: sent > 0 ? Math.round((delivered / sent) * 100) : 0,
    readRate: delivered > 0 ? Math.round((read / delivered) * 100) : 0,
    failureRate: (sent + failed) > 0 ? Math.round((failed / (sent + failed)) * 100) : 0
  };
}

/**
 * Handle campaign-specific errors
 */
function handleCampaignError(err, res, next) {
  const message = err.message || '';
  
  // Map error messages to HTTP responses
  const errorMappings = [
    { match: 'CAMPAIGN_NOT_FOUND', status: 404, code: 'CAMPAIGN_NOT_FOUND' },
    { match: 'WORKSPACE_NOT_FOUND', status: 404, code: 'WORKSPACE_NOT_FOUND' },
    { match: 'TEMPLATE_NOT_FOUND', status: 404, code: 'TEMPLATE_NOT_FOUND' },
    { match: 'TEMPLATE_NOT_APPROVED', status: 400, code: 'TEMPLATE_NOT_APPROVED' },
    { match: 'TEMPLATE_REVOKED', status: 400, code: 'TEMPLATE_REVOKED' },
    { match: 'TEMPLATE_REQUIRED', status: 400, code: 'TEMPLATE_REQUIRED' },
    { match: 'ACCOUNT_BLOCKED', status: 403, code: 'ACCOUNT_BLOCKED' },
    { match: 'TOKEN_EXPIRED', status: 403, code: 'TOKEN_EXPIRED' },
    { match: 'DAILY_LIMIT_EXCEEDED', status: 429, code: 'DAILY_LIMIT_EXCEEDED' },
    { match: 'MONTHLY_LIMIT_EXCEEDED', status: 429, code: 'MONTHLY_LIMIT_EXCEEDED' },
    { match: 'CAMPAIGN_LIMIT_EXCEEDED', status: 429, code: 'CAMPAIGN_LIMIT_EXCEEDED' },
    { match: 'INVALID_STATUS', status: 400, code: 'INVALID_STATUS' },
    { match: 'WHATSAPP_NOT_CONNECTED', status: 400, code: 'WHATSAPP_NOT_CONNECTED' },
    { match: 'CONTACTS_REQUIRED', status: 400, code: 'CONTACTS_REQUIRED' },
    { match: 'INVALID_CONTACTS', status: 400, code: 'INVALID_CONTACTS' },
    { match: 'VARIABLE_MAPPING_REQUIRED', status: 400, code: 'VARIABLE_MAPPING_REQUIRED' },
    { match: 'VARIABLE_NOT_MAPPED', status: 400, code: 'VARIABLE_NOT_MAPPED' }
  ];
  
  for (const mapping of errorMappings) {
    if (message.includes(mapping.match)) {
      return res.status(mapping.status).json({
        success: false,
        code: mapping.code,
        message: message.replace(`${mapping.match}:`, '').trim() || mapping.match
      });
    }
  }
  
  // Pass to global error handler
  next(err);
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // CRUD
  createCampaign,
  listCampaigns,
  getCampaign,
  updateCampaign,
  deleteCampaign,
  getCampaignStats,
  
  // Lifecycle
  startCampaign,
  enqueueCampaign,
  pauseCampaign,
  resumeCampaign,
  
  // Progress
  getCampaignProgress,
  getCampaignSummary,
  getCampaignMessages
};
