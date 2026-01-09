const Workspace = require('../models/Workspace');
const User = require('../models/User');
const { updateAllWorkspacesWABA } = require('../services/initService');

// Get all WhatsApp setup requests
async function getWhatsAppSetupRequests(req, res, next) {
  try {
    // TODO: Add admin role check
    // if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    //   return res.status(403).json({ message: 'Unauthorized' });
    // }

    const { status } = req.query;
    
    const query = { 'whatsappSetup.requestedNumber': { $exists: true } };
    if (status) {
      query['whatsappSetup.status'] = status;
    }

    const workspaces = await Workspace.find(query)
      .select('name whatsappSetup createdAt')
      .sort({ 'whatsappSetup.requestedAt': -1 })
      .limit(100);

    // Get user details for each workspace
    const requests = await Promise.all(
      workspaces.map(async (workspace) => {
        const owner = await User.findOne({ workspace: workspace._id, role: 'owner' })
          .select('name email phone');
        
        return {
          workspaceId: workspace._id,
          workspaceName: workspace.name,
          owner: owner ? {
            name: owner.name,
            email: owner.email,
            phone: owner.phone
          } : null,
          whatsappNumber: workspace.whatsappSetup.requestedNumber,
          hasExistingAccount: workspace.whatsappSetup.hasExistingAccount,
          status: workspace.whatsappSetup.status,
          requestedAt: workspace.whatsappSetup.requestedAt,
          completedAt: workspace.whatsappSetup.completedAt,
          notes: workspace.whatsappSetup.notes
        };
      })
    );

    res.json({
      success: true,
      count: requests.length,
      requests
    });
  } catch (err) {
    next(err);
  }
}

// Update WhatsApp setup request status
async function updateWhatsAppSetupStatus(req, res, next) {
  try {
    // TODO: Add admin role check
    
    const { workspaceId } = req.params;
    const { status, notes, phoneNumberId, accessToken, wabaId } = req.body;

    const workspace = await Workspace.findById(workspaceId);
    
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    if (!workspace.whatsappSetup) {
      return res.status(400).json({ message: 'No WhatsApp setup request found' });
    }

    // Update status
    if (status) {
      workspace.whatsappSetup.status = status;
    }

    if (notes) {
      workspace.whatsappSetup.notes = notes;
    }

    // If marking as connected, save the credentials
    if (status === 'connected') {
      workspace.whatsappSetup.completedAt = new Date();
      workspace.whatsappSetup.completedBy = req.user.email || req.user.name;
      
      if (phoneNumberId) workspace.whatsappPhoneNumberId = phoneNumberId;
      if (accessToken) workspace.whatsappAccessToken = accessToken;
      if (wabaId) workspace.wabaId = wabaId;
      
      workspace.connectedAt = new Date();
      
      // Mark onboarding step as completed
      if (!workspace.onboarding) {
        workspace.onboarding = {};
      }
      workspace.onboarding.wabaConnectionCompleted = true;
      workspace.onboarding.wabaConnectionCompletedAt = new Date();
    }

    await workspace.save();

    // TODO: Send email notification to customer

    res.json({
      success: true,
      message: 'WhatsApp setup status updated',
      workspace: {
        id: workspace._id,
        name: workspace.name,
        status: workspace.whatsappSetup.status
      }
    });
  } catch (err) {
    next(err);
  }
}

// Force update all workspaces with WABA credentials from environment
async function reinitializeAllWABA(req, res, next) {
  try {
    const result = await updateAllWorkspacesWABA();
    
    res.json({
      success: true,
      message: 'All workspaces updated with WABA credentials from environment',
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount
    });
  } catch (err) {
    next(err);
  }
}

// Get all business verification requests
async function getVerificationRequests(req, res, next) {
  try {
    const { status } = req.query;
    
    const query = { 'businessDocuments.submittedAt': { $exists: true } };
    if (status) {
      query['businessVerification.status'] = status;
    }

    const workspaces = await Workspace.find(query)
      .select('name businessDocuments businessVerification industry createdAt')
      .sort({ 'businessDocuments.submittedAt': -1 })
      .limit(100);

    // Get user details for each workspace
    const requests = await Promise.all(
      workspaces.map(async (workspace) => {
        const owner = await User.findOne({ workspace: workspace._id, role: 'owner' })
          .select('name email phone');
        
        return {
          workspaceId: workspace._id,
          workspaceName: workspace.name,
          industry: workspace.industry,
          owner: owner ? {
            name: owner.name,
            email: owner.email,
            phone: owner.phone
          } : null,
          documents: {
            gstNumber: workspace.businessDocuments?.gstNumber,
            msmeNumber: workspace.businessDocuments?.msmeNumber,
            panNumber: workspace.businessDocuments?.panNumber,
            documentType: workspace.businessDocuments?.documentType
          },
          verificationStatus: workspace.businessVerification?.status || 'pending',
          submittedAt: workspace.businessDocuments?.submittedAt,
          verifiedAt: workspace.businessVerification?.verifiedAt,
          rejectionReason: workspace.businessVerification?.rejectionReason
        };
      })
    );

    res.json({
      success: true,
      count: requests.length,
      requests
    });
  } catch (err) {
    next(err);
  }
}

// Update business verification status (manual admin override)
async function updateVerificationStatus(req, res, next) {
  try {
    const { workspaceId } = req.params;
    const { status, rejectionReason, notes } = req.body;

    const validStatuses = ['not_submitted', 'pending', 'in_review', 'verified', 'rejected'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ 
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      });
    }

    const workspace = await Workspace.findById(workspaceId);
    
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    if (!workspace.businessVerification) {
      workspace.businessVerification = {};
    }

    // Update status
    if (status) {
      workspace.businessVerification.status = status;
      workspace.businessVerification.lastCheckedAt = new Date();

      if (status === 'verified') {
        workspace.businessVerification.verifiedAt = new Date();
        workspace.businessVerification.verifiedBy = req.user?.email || 'admin';
      } else if (status === 'rejected') {
        workspace.businessVerification.rejectedAt = new Date();
        if (rejectionReason) {
          workspace.businessVerification.rejectionReason = rejectionReason;
        }
      }
    }

    if (notes) {
      workspace.businessVerification.adminNotes = notes;
    }

    await workspace.save();

    // TODO: Send email notification to customer about status change

    res.json({
      success: true,
      message: `Business verification status updated to '${status}'`,
      workspace: {
        id: workspace._id,
        name: workspace.name,
        verificationStatus: workspace.businessVerification.status
      }
    });
  } catch (err) {
    next(err);
  }
}

// Manually activate WhatsApp for a workspace (admin override)
async function manuallyActivateWhatsApp(req, res, next) {
  try {
    const { workspaceId } = req.params;
    const { phoneNumberId, accessToken, wabaId, displayPhoneNumber, verifiedName } = req.body;

    if (!phoneNumberId) {
      return res.status(400).json({ message: 'Phone Number ID is required' });
    }

    const workspace = await Workspace.findById(workspaceId);
    
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    // Update workspace with WhatsApp credentials
    workspace.whatsappPhoneNumberId = phoneNumberId;
    if (accessToken) workspace.whatsappAccessToken = accessToken;
    if (wabaId) workspace.wabaId = wabaId;
    if (displayPhoneNumber) workspace.whatsappPhoneNumber = displayPhoneNumber;
    workspace.connectedAt = new Date();

    // Update whatsapp setup status
    if (!workspace.whatsappSetup) {
      workspace.whatsappSetup = {};
    }
    workspace.whatsappSetup.status = 'connected';
    workspace.whatsappSetup.completedAt = new Date();
    workspace.whatsappSetup.completedBy = req.user?.email || 'admin';
    if (displayPhoneNumber) {
      workspace.whatsappSetup.requestedNumber = displayPhoneNumber.replace(/\D/g, '');
    }

    // Mark onboarding step as completed
    if (!workspace.onboarding) {
      workspace.onboarding = {};
    }
    workspace.onboarding.wabaConnectionCompleted = true;
    workspace.onboarding.wabaConnectionCompletedAt = new Date();

    await workspace.save();

    console.log(`✅ Admin manually activated WhatsApp for workspace ${workspace._id}`);

    res.json({
      success: true,
      message: 'WhatsApp manually activated for workspace',
      workspace: {
        id: workspace._id,
        name: workspace.name,
        phoneNumberId: workspace.whatsappPhoneNumberId,
        phoneNumber: workspace.whatsappPhoneNumber,
        status: 'connected'
      }
    });
  } catch (err) {
    next(err);
  }
}

// ========================
// ADMIN DASHBOARD ENDPOINTS
// ========================

// Get all workspaces/tenants with summary
async function getAllWorkspaces(req, res, next) {
  try {
    const { page = 1, limit = 20, search, status, plan } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { 'esbFlow.createdBy': { $regex: search, $options: 'i' } }
      ];
    }
    if (plan) query.plan = plan;
    if (status) query['esbFlow.status'] = status;

    const workspaces = await Workspace.find(query)
      .select('name plan esbFlow businessVerification whatsappPhoneNumber createdAt updatedAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Workspace.countDocuments(query);

    // Enrich with user information
    const enrichedWorkspaces = await Promise.all(
      workspaces.map(async (ws) => {
        const owner = await User.findOne({ workspace: ws._id, role: 'owner' })
          .select('name email phone');
        const memberCount = await User.countDocuments({ workspace: ws._id });

        return {
          id: ws._id,
          name: ws.name,
          plan: ws.plan,
          owner: owner ? { name: owner.name, email: owner.email } : null,
          memberCount,
          wabaStatus: ws.esbFlow?.status || 'not_started',
          phoneNumber: ws.whatsappPhoneNumber,
          verificationStatus: ws.businessVerification?.status || 'not_submitted',
          createdAt: ws.createdAt,
          updatedAt: ws.updatedAt
        };
      })
    );

    res.json({
      success: true,
      data: enrichedWorkspaces,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    next(err);
  }
}

// Get single workspace details
async function getWorkspaceDetails(req, res, next) {
  try {
    const { workspaceId } = req.params;

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace not found' });
    }

    const owner = await User.findOne({ workspace: workspaceId, role: 'owner' });
    const members = await User.find({ workspace: workspaceId });

    res.json({
      success: true,
      data: {
        id: workspace._id,
        name: workspace.name,
        plan: workspace.plan,
        industry: workspace.industry,
        website: workspace.website,
        owner: owner ? { name: owner.name, email: owner.email, phone: owner.phone } : null,
        members: members.map(m => ({ id: m._id, name: m.name, email: m.email, role: m.role })),
        waba: {
          status: workspace.esbFlow?.status,
          phoneNumber: workspace.whatsappPhoneNumber,
          phoneNumberId: workspace.whatsappPhoneNumberId,
          wabaId: workspace.wabaId,
          accountStatus: workspace.esbFlow?.metaAccountStatus
        },
        verification: {
          status: workspace.businessVerification?.status,
          submittedAt: workspace.businessVerification?.submittedAt,
          verifiedAt: workspace.businessVerification?.verifiedAt,
          verifiedBy: workspace.businessVerification?.verifiedBy,
          rejectionReason: workspace.businessVerification?.rejectionReason
        },
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt
      }
    });
  } catch (err) {
    next(err);
  }
}

// Suspend/Pause workspace
async function suspendWorkspace(req, res, next) {
  try {
    const { workspaceId } = req.params;
    const { reason } = req.body;

    const workspace = await Workspace.findByIdAndUpdate(
      workspaceId,
      {
        'esbFlow.accountBlocked': true,
        'esbFlow.accountBlockedReason': reason,
        suspended: true,
        suspendedAt: new Date(),
        suspendedBy: req.user.email
      },
      { new: true }
    );

    res.json({
      success: true,
      message: 'Workspace suspended successfully',
      data: { id: workspace._id, status: 'suspended' }
    });
  } catch (err) {
    next(err);
  }
}

// Resume workspace
async function resumeWorkspace(req, res, next) {
  try {
    const { workspaceId } = req.params;

    const workspace = await Workspace.findByIdAndUpdate(
      workspaceId,
      {
        'esbFlow.accountBlocked': false,
        'esbFlow.accountBlockedReason': null,
        suspended: false,
        suspendedAt: null,
        suspendedBy: null
      },
      { new: true }
    );

    res.json({
      success: true,
      message: 'Workspace resumed successfully',
      data: { id: workspace._id, status: 'active' }
    });
  } catch (err) {
    next(err);
  }
}

// Get WABA health for all workspaces
async function getWABAHealth(req, res, next) {
  try {
    const { status } = req.query;

    let query = { 'esbFlow.status': 'completed' };
    if (status) query['esbFlow.metaAccountStatus'] = status;

    const workspaces = await Workspace.find(query)
      .select('name whatsappPhoneNumber esbFlow')
      .limit(50);

    const wabaHealth = workspaces.map(ws => ({
      workspaceId: ws._id,
      workspaceName: ws.name,
      phoneNumber: ws.whatsappPhoneNumber,
      accountStatus: ws.esbFlow?.metaAccountStatus || 'UNKNOWN',
      lastCheckedAt: ws.esbFlow?.metaAccountStatusUpdatedAt,
      blocked: ws.esbFlow?.accountBlocked,
      blockReason: ws.esbFlow?.accountBlockedReason,
      capabilities: ws.esbFlow?.metaCapabilities
    }));

    res.json({
      success: true,
      data: wabaHealth,
      total: wabaHealth.length
    });
  } catch (err) {
    next(err);
  }
}

// Get usage and spending analytics
async function getAnalytics(req, res, next) {
  try {
    const { startDate, endDate, metric = 'all' } = req.query;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Get workspace statistics
    const totalWorkspaces = await Workspace.countDocuments();
    const activeWorkspaces = await Workspace.countDocuments({
      'esbFlow.status': 'completed',
      createdAt: { $gte: start, $lte: end }
    });

    // Plan distribution
    const planDistribution = await Workspace.aggregate([
      { $group: { _id: '$plan', count: { $sum: 1 } } }
    ]);

    // Verification status distribution
    const verificationDistribution = await Workspace.aggregate([
      { $group: { _id: '$businessVerification.status', count: { $sum: 1 } } }
    ]);

    // WABA status distribution
    const wabaDistribution = await Workspace.aggregate([
      { $group: { _id: '$esbFlow.status', count: { $sum: 1 } } }
    ]);

    // Usage metrics (if you have usage tracking models)
    const analytics = {
      overview: {
        totalWorkspaces,
        activeWorkspaces,
        suspension_rate: ((await Workspace.countDocuments({ suspended: true }) / totalWorkspaces) * 100).toFixed(2) + '%'
      },
      plans: planDistribution.reduce((acc, p) => {
        acc[p._id] = p.count;
        return acc;
      }, {}),
      verification: verificationDistribution.reduce((acc, v) => {
        acc[v._id] = v.count;
        return acc;
      }, {}),
      wabaStatus: wabaDistribution.reduce((acc, w) => {
        acc[w._id] = w.count;
        return acc;
      }, {})
    };

    res.json({
      success: true,
      data: analytics,
      period: { start, end }
    });
  } catch (err) {
    next(err);
  }
}

// Manage templates (approve/reject)
async function getTemplatesForApproval(req, res, next) {
  try {
    const { page = 1, limit = 20, status = 'pending' } = req.query;
    const skip = (page - 1) * limit;

    const Template = require('../models/Template');
    const templates = await Template.find({ status })
      .populate('workspace', 'name')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Template.countDocuments({ status });

    res.json({
      success: true,
      data: templates,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    next(err);
  }
}

// Approve/Reject template
async function updateTemplateStatus(req, res, next) {
  try {
    const { templateId } = req.params;
    const { status, rejectionReason } = req.body;

    const Template = require('../models/Template');
    const template = await Template.findByIdAndUpdate(
      templateId,
      {
        status,
        rejectionReason: status === 'rejected' ? rejectionReason : null,
        approvedBy: req.user.email,
        approvedAt: new Date()
      },
      { new: true }
    );

    res.json({
      success: true,
      message: `Template ${status}`,
      data: template
    });
  } catch (err) {
    next(err);
  }
}

// Get campaign analytics
async function getCampaignAnalytics(req, res, next) {
  try {
    const Campaign = require('../models/Campaign');
    const Message = require('../models/Message');

    const campaigns = await Campaign.find()
      .select('name status createdAt workspace')
      .sort({ createdAt: -1 })
      .limit(50);

    const campaignStats = await Promise.all(
      campaigns.map(async (campaign) => {
        const messages = await Message.find({ campaign: campaign._id });
        const sent = messages.filter(m => m.status === 'sent').length;
        const delivered = messages.filter(m => m.status === 'delivered').length;
        const failed = messages.filter(m => m.status === 'failed').length;

        return {
          id: campaign._id,
          name: campaign.name,
          status: campaign.status,
          totalMessages: messages.length,
          sent,
          delivered,
          failed,
          successRate: messages.length ? ((sent / messages.length) * 100).toFixed(2) : 0,
          createdAt: campaign.createdAt
        };
      })
    );

    res.json({
      success: true,
      data: campaignStats
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getWhatsAppSetupRequests,
  updateWhatsAppSetupStatus,
  reinitializeAllWABA,
  getVerificationRequests,
  updateVerificationStatus,
  manuallyActivateWhatsApp,
  // New endpoints
  getAllWorkspaces,
  getWorkspaceDetails,
  suspendWorkspace,
  resumeWorkspace,
  getWABAHealth,
  getAnalytics,
  getTemplatesForApproval,
  updateTemplateStatus,
  getCampaignAnalytics
};
