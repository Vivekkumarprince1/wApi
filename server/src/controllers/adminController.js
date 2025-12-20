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

module.exports = {
  getWhatsAppSetupRequests,
  updateWhatsAppSetupStatus,
  reinitializeAllWABA,
  getVerificationRequests,
  updateVerificationStatus,
  manuallyActivateWhatsApp
};
