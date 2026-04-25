const IntegrationApp = require('../../models/integration/IntegrationApp');
const WorkspaceIntegration = require('../../models/integration/WorkspaceIntegration');
// const WorkflowService = require('../../services/automation/workflowService');

exports.handleIncomingWebhook = async (req, res) => {
  try {
    const { appSlug, workspaceId } = req.params;
    const payload = req.body;
    
    // Find the workspace connection
    const integration = await WorkspaceIntegration.findOne({ workspaceId }).populate('appId');
    if (!integration || integration.appId.slug !== appSlug) {
        return res.status(404).json({ success: false, message: 'Integration not found or inactive' });
    }

    if (integration.status !== 'CONNECTED') {
        return res.status(400).json({ success: false, message: 'Integration disconnected' });
    }

    // Log the event or trigger workflows (mocked for now)
    console.log(`[WEBHOOK] Received event from ${appSlug} for workspace ${workspaceId}`);
    
    // Ideally normalize data based on appSlug, e.g.:
    // let normalizedData = normalizeShopifyPayload(payload);
    // await WorkflowService.triggerEvent({ workspaceId, event: normalizedData.event, ... });

    res.status(200).send('OK');
  } catch (error) {
    console.error(`Webhook error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
};
