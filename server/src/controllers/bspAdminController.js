/**
 * BSP Admin Controller
 * 
 * Administrative functions for managing the BSP multi-tenant platform.
 * These endpoints are for platform admins only (not tenant users).
 * 
 * Provides:
 * - Phone number assignment to workspaces
 * - Tenant status monitoring
 * - Quality rating tracking
 * - Usage analytics across all tenants
 */

const Workspace = require('../models/Workspace');
const WebhookLog = require('../models/WebhookLog');
const Message = require('../models/Message');
const bspConfig = require('../config/bspConfig');
const bspMessagingService = require('../services/bspMessagingService');
const { invalidatePhoneCache } = require('../middlewares/bspTenantRouter');

/**
 * ═══════════════════════════════════════════════════════════════════
 * PHONE NUMBER MANAGEMENT
 * ═══════════════════════════════════════════════════════════════════
 */

/**
 * Assign a phone number to a workspace
 * POST /api/admin/bsp/assign-phone
 */
async function assignPhoneNumber(req, res, next) {
  try {
    const { workspaceId, phoneNumberId, displayPhoneNumber } = req.body;
    
    if (!workspaceId || !phoneNumberId) {
      return res.status(400).json({
        success: false,
        message: 'workspaceId and phoneNumberId are required'
      });
    }
    
    // Check if phone number is already assigned
    const existingWorkspace = await Workspace.findOne({ bspPhoneNumberId: phoneNumberId });
    if (existingWorkspace && existingWorkspace._id.toString() !== workspaceId) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is already assigned to another workspace',
        existingWorkspace: existingWorkspace.name
      });
    }
    
    // Get workspace
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found'
      });
    }
    
    // Fetch phone number details from Meta (optional but recommended)
    let phoneDetails = null;
    try {
      const result = await bspMessagingService.getPhoneNumberDetails(phoneNumberId);
      phoneDetails = result.phoneNumber;
    } catch (metaErr) {
      console.warn(`[BSP Admin] Could not fetch phone details: ${metaErr.message}`);
    }
    
    // Update workspace
    workspace.bspManaged = true;
    workspace.bspWabaId = bspConfig.parentWabaId;
    workspace.bspPhoneNumberId = phoneNumberId;
    workspace.bspDisplayPhoneNumber = displayPhoneNumber || phoneDetails?.display_phone_number;
    workspace.bspVerifiedName = phoneDetails?.verified_name;
    workspace.bspPhoneStatus = 'CONNECTED';
    workspace.bspQualityRating = phoneDetails?.quality_rating || 'UNKNOWN';
    workspace.bspMessagingTier = phoneDetails?.messaging_limit_tier || 'TIER_1K';
    workspace.bspOnboardedAt = new Date();
    
    // Initialize BSP usage
    if (!workspace.bspUsage) {
      workspace.bspUsage = {
        messagesToday: 0,
        messagesThisMonth: 0,
        templateSubmissionsToday: 0,
        lastUsageReset: new Date(),
        lastMonthlyReset: new Date()
      };
    }
    
    // Audit trail
    workspace.bspAudit = workspace.bspAudit || {};
    workspace.bspAudit.phoneAssignedAt = new Date();
    workspace.bspAudit.phoneAssignedBy = req.user?.email || 'system';
    
    await workspace.save();
    
    // Invalidate routing cache
    invalidatePhoneCache(phoneNumberId);
    
    res.json({
      success: true,
      message: 'Phone number assigned successfully',
      workspace: {
        id: workspace._id,
        name: workspace.name,
        bspPhoneNumberId: workspace.bspPhoneNumberId,
        bspDisplayPhoneNumber: workspace.bspDisplayPhoneNumber,
        bspVerifiedName: workspace.bspVerifiedName,
        bspPhoneStatus: workspace.bspPhoneStatus
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Unassign a phone number from a workspace
 * POST /api/admin/bsp/unassign-phone
 */
async function unassignPhoneNumber(req, res, next) {
  try {
    const { workspaceId } = req.body;
    
    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        message: 'workspaceId is required'
      });
    }
    
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found'
      });
    }
    
    const oldPhoneNumberId = workspace.bspPhoneNumberId;
    
    // Clear BSP fields
    workspace.bspPhoneNumberId = null;
    workspace.bspDisplayPhoneNumber = null;
    workspace.bspPhoneStatus = 'DISCONNECTED';
    
    // Add audit note
    if (!workspace.bspAudit.warnings) {
      workspace.bspAudit.warnings = [];
    }
    workspace.bspAudit.warnings.push({
      type: 'phone_unassigned',
      message: `Phone ${oldPhoneNumberId} unassigned by ${req.user?.email || 'system'}`,
      createdAt: new Date()
    });
    
    await workspace.save();
    
    // Invalidate routing cache
    if (oldPhoneNumberId) {
      invalidatePhoneCache(oldPhoneNumberId);
    }
    
    res.json({
      success: true,
      message: 'Phone number unassigned successfully',
      workspace: {
        id: workspace._id,
        name: workspace.name
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * ═══════════════════════════════════════════════════════════════════
 * TENANT MONITORING
 * ═══════════════════════════════════════════════════════════════════
 */

/**
 * Get all BSP managed workspaces with status
 * GET /api/admin/bsp/tenants
 */
async function listBspTenants(req, res, next) {
  try {
    const { status, qualityRating, plan, page = 1, limit = 50 } = req.query;
    
    const query = { bspManaged: true };
    
    if (status) query.bspPhoneStatus = status;
    if (qualityRating) query.bspQualityRating = qualityRating;
    if (plan) query.plan = plan;
    
    const total = await Workspace.countDocuments(query);
    
    const tenants = await Workspace.find(query)
      .select('name plan bspPhoneNumberId bspDisplayPhoneNumber bspVerifiedName bspPhoneStatus bspQualityRating bspMessagingTier bspUsage bspOnboardedAt')
      .sort({ bspOnboardedAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();
    
    // Add usage percentages
    const tenantsWithUsage = tenants.map(tenant => {
      const plan = tenant.plan || 'free';
      const dailyLimit = bspConfig.getRateLimit(plan, 'dailyMessageLimit');
      const monthlyLimit = bspConfig.getRateLimit(plan, 'monthlyMessageLimit');
      
      return {
        ...tenant,
        usagePercentages: {
          daily: Math.round(((tenant.bspUsage?.messagesToday || 0) / dailyLimit) * 100),
          monthly: Math.round(((tenant.bspUsage?.messagesThisMonth || 0) / monthlyLimit) * 100)
        }
      };
    });
    
    res.json({
      success: true,
      tenants: tenantsWithUsage,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit)
      },
      summary: {
        total,
        byStatus: await Workspace.aggregate([
          { $match: { bspManaged: true } },
          { $group: { _id: '$bspPhoneStatus', count: { $sum: 1 } } }
        ]),
        byQuality: await Workspace.aggregate([
          { $match: { bspManaged: true } },
          { $group: { _id: '$bspQualityRating', count: { $sum: 1 } } }
        ])
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get detailed tenant info including usage analytics
 * GET /api/admin/bsp/tenants/:workspaceId
 */
async function getTenantDetails(req, res, next) {
  try {
    const { workspaceId } = req.params;
    
    const workspace = await Workspace.findById(workspaceId).lean();
    
    if (!workspace || !workspace.bspManaged) {
      return res.status(404).json({
        success: false,
        message: 'BSP tenant not found'
      });
    }
    
    // Get message stats for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const messageStats = await Message.aggregate([
      {
        $match: {
          workspace: workspace._id,
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            direction: '$direction',
            status: '$status'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.date': -1 } }
    ]);
    
    // Get webhook logs
    const recentWebhooks = await WebhookLog.find({
      workspace: workspace._id
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('eventType processed error createdAt')
      .lean();
    
    res.json({
      success: true,
      tenant: {
        ...workspace,
        limits: {
          messagesPerSecond: workspace.bspRateLimits?.messagesPerSecond ||
            bspConfig.getRateLimit(workspace.plan || 'free', 'messagesPerSecond'),
          dailyMessageLimit: workspace.bspRateLimits?.dailyMessageLimit ||
            bspConfig.getRateLimit(workspace.plan || 'free', 'dailyMessageLimit'),
          monthlyMessageLimit: workspace.bspRateLimits?.monthlyMessageLimit ||
            bspConfig.getRateLimit(workspace.plan || 'free', 'monthlyMessageLimit')
        }
      },
      analytics: {
        messageStats,
        recentWebhooks
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Update tenant rate limits (custom overrides)
 * PATCH /api/admin/bsp/tenants/:workspaceId/limits
 */
async function updateTenantLimits(req, res, next) {
  try {
    const { workspaceId } = req.params;
    const { messagesPerSecond, dailyMessageLimit, monthlyMessageLimit, templateSubmissionsPerDay } = req.body;
    
    const workspace = await Workspace.findById(workspaceId);
    
    if (!workspace || !workspace.bspManaged) {
      return res.status(404).json({
        success: false,
        message: 'BSP tenant not found'
      });
    }
    
    if (!workspace.bspRateLimits) {
      workspace.bspRateLimits = {};
    }
    
    if (messagesPerSecond !== undefined) {
      workspace.bspRateLimits.messagesPerSecond = messagesPerSecond;
    }
    if (dailyMessageLimit !== undefined) {
      workspace.bspRateLimits.dailyMessageLimit = dailyMessageLimit;
    }
    if (monthlyMessageLimit !== undefined) {
      workspace.bspRateLimits.monthlyMessageLimit = monthlyMessageLimit;
    }
    if (templateSubmissionsPerDay !== undefined) {
      workspace.bspRateLimits.templateSubmissionsPerDay = templateSubmissionsPerDay;
    }
    
    await workspace.save();
    
    res.json({
      success: true,
      message: 'Rate limits updated',
      limits: workspace.bspRateLimits
    });
  } catch (err) {
    next(err);
  }
}

/**
 * ═══════════════════════════════════════════════════════════════════
 * QUALITY & STATUS SYNC
 * ═══════════════════════════════════════════════════════════════════
 */

/**
 * Sync phone number status from Meta
 * POST /api/admin/bsp/sync-status/:workspaceId
 */
async function syncPhoneStatus(req, res, next) {
  try {
    const { workspaceId } = req.params;
    
    const workspace = await Workspace.findById(workspaceId);
    
    if (!workspace || !workspace.bspManaged || !workspace.bspPhoneNumberId) {
      return res.status(404).json({
        success: false,
        message: 'BSP tenant with phone number not found'
      });
    }
    
    try {
      const result = await bspMessagingService.getPhoneNumberDetails(workspace.bspPhoneNumberId);
      const phoneDetails = result.phoneNumber;
      
      workspace.bspVerifiedName = phoneDetails.verified_name;
      workspace.bspQualityRating = phoneDetails.quality_rating || 'UNKNOWN';
      workspace.bspMessagingTier = phoneDetails.messaging_limit_tier;
      workspace.bspAudit.lastStatusCheck = new Date();
      workspace.bspAudit.lastQualityUpdate = new Date();
      
      // Update status based on Meta response
      if (phoneDetails.status === 'CONNECTED' || phoneDetails.code_verification_status === 'VERIFIED') {
        workspace.bspPhoneStatus = 'CONNECTED';
      }
      
      await workspace.save();
      
      // Invalidate cache to reflect new status
      invalidatePhoneCache(workspace.bspPhoneNumberId);
      
      res.json({
        success: true,
        message: 'Status synced from Meta',
        phoneDetails: {
          verifiedName: workspace.bspVerifiedName,
          qualityRating: workspace.bspQualityRating,
          messagingTier: workspace.bspMessagingTier,
          status: workspace.bspPhoneStatus
        }
      });
    } catch (metaErr) {
      res.status(500).json({
        success: false,
        message: 'Failed to sync from Meta',
        error: metaErr.message
      });
    }
  } catch (err) {
    next(err);
  }
}

/**
 * ═══════════════════════════════════════════════════════════════════
 * PLATFORM ANALYTICS
 * ═══════════════════════════════════════════════════════════════════
 */

/**
 * Get BSP platform overview
 * GET /api/admin/bsp/overview
 */
async function getBspOverview(req, res, next) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    
    // Get tenant counts
    const tenantStats = await Workspace.aggregate([
      { $match: { bspManaged: true } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          connected: { $sum: { $cond: [{ $eq: ['$bspPhoneStatus', 'CONNECTED'] }, 1, 0] } },
          banned: { $sum: { $cond: [{ $eq: ['$bspPhoneStatus', 'BANNED'] }, 1, 0] } },
          rateLimited: { $sum: { $cond: [{ $eq: ['$bspPhoneStatus', 'RATE_LIMITED'] }, 1, 0] } },
          greenQuality: { $sum: { $cond: [{ $eq: ['$bspQualityRating', 'GREEN'] }, 1, 0] } },
          yellowQuality: { $sum: { $cond: [{ $eq: ['$bspQualityRating', 'YELLOW'] }, 1, 0] } },
          redQuality: { $sum: { $cond: [{ $eq: ['$bspQualityRating', 'RED'] }, 1, 0] } }
        }
      }
    ]);
    
    // Get message volume
    const messageStats = await Message.aggregate([
      {
        $match: {
          createdAt: { $gte: thisMonth }
        }
      },
      {
        $group: {
          _id: null,
          totalMessages: { $sum: 1 },
          outbound: { $sum: { $cond: [{ $eq: ['$direction', 'outbound'] }, 1, 0] } },
          inbound: { $sum: { $cond: [{ $eq: ['$direction', 'inbound'] }, 1, 0] } },
          sent: { $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] } },
          delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } }
        }
      }
    ]);
    
    // Get webhook health
    const webhookHealth = await WebhookLog.aggregate([
      {
        $match: {
          createdAt: { $gte: today }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          processed: { $sum: { $cond: ['$processed', 1, 0] } },
          failed: { $sum: { $cond: [{ $ne: ['$error', null] }, 1, 0] } },
          bspRouted: { $sum: { $cond: ['$bspRouted', 1, 0] } }
        }
      }
    ]);
    
    res.json({
      success: true,
      overview: {
        tenants: tenantStats[0] || { total: 0 },
        messages: messageStats[0] || { totalMessages: 0 },
        webhooks: webhookHealth[0] || { total: 0 },
        bspConfig: {
          parentWabaId: bspConfig.parentWabaId,
          isConfigured: bspConfig.isEnabled()
        }
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  assignPhoneNumber,
  unassignPhoneNumber,
  listBspTenants,
  getTenantDetails,
  updateTenantLimits,
  syncPhoneStatus,
  getBspOverview
};
