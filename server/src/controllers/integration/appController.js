const IntegrationApp = require('../../models/integration/IntegrationApp');
const WorkspaceIntegration = require('../../models/integration/WorkspaceIntegration');

// List all available apps in the catalog
exports.getAvailableApps = async (req, res) => {
  try {
    const apps = await IntegrationApp.find({ status: { $ne: 'COMING_SOON' } });
    
    // If authenticated, also fetch which ones are connected
    let connectedIntegrations = [];
    if (req.user && req.workspace) {
      connectedIntegrations = await WorkspaceIntegration.find({ workspaceId: req.workspace._id });
    }

    const result = apps.map(app => {
      const isConnected = connectedIntegrations.find(ci => ci.appId.toString() === app._id.toString());
      return {
        ...app.toObject(),
        isConnected: !!isConnected,
        connectionDetails: isConnected || null
      };
    });

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Connect an app via API Key
exports.connectApiKeyApp = async (req, res) => {
  try {
    const { appSlug } = req.params;
    const { apiKey, storeUrl } = req.body;
    const workspaceId = req.workspace._id;

    const app = await IntegrationApp.findOne({ slug: appSlug });
    if (!app) return res.status(404).json({ success: false, message: 'App not found in registry' });

    if (app.authType !== 'API_KEY') {
      return res.status(400).json({ success: false, message: 'This app does not use API Key auth' });
    }

    // Upsert the workspace integration
    const integration = await WorkspaceIntegration.findOneAndUpdate(
      { workspaceId, appId: app._id },
      { 
        status: 'CONNECTED',
        credentials: { apiKey, storeUrl }
      },
      { new: true, upsert: true }
    );

    res.json({ success: true, message: `${app.name} connected successfully`, data: integration });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Disconnect App
exports.disconnectApp = async (req, res) => {
  try {
    const { appSlug } = req.params;
    const workspaceId = req.workspace._id;

    const app = await IntegrationApp.findOne({ slug: appSlug });
    if (!app) return res.status(404).json({ success: false, message: 'App not found' });

    await WorkspaceIntegration.findOneAndUpdate(
      { workspaceId, appId: app._id },
      { status: 'DISCONNECTED', credentials: {} }
    );

    res.json({ success: true, message: `${app.name} disconnected` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
