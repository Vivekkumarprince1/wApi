const gupshupService = require('../../services/bsp/gupshupService');
const { Workspace } = require('../../models');
const { decryptToken, resolveWhatsAppWebhookUrl } = require('../../services/bsp/gupshupProvisioningService');

/**
 * Connection Controller
 * Handles repair and health checks for WhatsApp Business API connections.
 */

/**
 * Repair a WhatsApp connection for a workspace.
 * This triggers the mandatory "Finalization" steps (Whitelist + Credit Line) 
 * and refreshes webhook subscriptions.
 */
async function repairConnection(req, res) {
  try {
    const { workspaceId } = req.body;
    if (!workspaceId) {
      return res.status(400).json({ success: false, message: 'Workspace ID is required' });
    }

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace not found' });
    }

    const appId = workspace.gupshupIdentity?.partnerAppId || workspace.gupshupAppId;
    if (!appId) {
      return res.status(400).json({ success: false, message: 'No Gupshup App ID found for this workspace' });
    }

    console.log(`[ConnectionRepair] Starting repair for workspace ${workspaceId} (App: ${appId})`);
    
    // 1. Resolve API Key
    const appApiKeyEncrypted = workspace.gupshupIdentity?.appApiKey;
    let appApiKey = appApiKeyEncrypted ? decryptToken(appApiKeyEncrypted) : null;
    
    if (!appApiKey) {
      console.log(`[ConnectionRepair] API Key missing, resolving from Partner Token...`);
      appApiKey = await gupshupService.getPartnerAppAccessToken(appId);
    }

    const results = {
      health: null,
      whitelist: null,
      creditLine: null,
      subscriptions: null
    };

    // 2. Check Health
    try {
      results.health = await gupshupService.getWabaHealth({ appId, appApiKey });
    } catch (err) {
      results.health = { healthy: false, error: err.message };
    }

    // 3. Finalization Step 1: Whitelist
    try {
      results.whitelist = await gupshupService.whitelistWaba(appId);
    } catch (err) {
      results.whitelist = { success: false, error: err.message };
    }

    // 4. Finalization Step 2: Credit Line
    try {
      results.creditLine = await gupshupService.verifyAndAttachCreditLine(appId);
    } catch (err) {
      results.creditLine = { success: false, error: err.message };
    }

    // 5. Refresh Subscriptions
    try {
      const webhookUrl = resolveWhatsAppWebhookUrl();
      if (webhookUrl) {
        await gupshupService.ensureRequiredSubscriptions({
          appId,
          appApiKey,
          webhookUrl
        });
        results.subscriptions = { success: true, url: webhookUrl };
      } else {
        results.subscriptions = { success: false, error: 'No public webhook URL configured' };
      }
    } catch (err) {
      results.subscriptions = { success: false, error: err.message };
    }

    // Update workspace status
    workspace.whatsappConnected = results.health?.healthy || false;
    workspace.onboardingStatus = 'completed';
    await workspace.save();

    return res.status(200).json({
      success: true,
      message: 'Connection repair completed',
      results
    });
  } catch (error) {
    console.error('[ConnectionRepair] Fatal error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to repair connection',
      error: error.message
    });
  }
}

module.exports = {
  repairConnection
};
