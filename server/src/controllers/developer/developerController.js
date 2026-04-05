const { Workspace } = require('../../models');
const crypto = require('crypto');

/*
 * Generate a new API key for the workspace
 */
exports.generateApiKey = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    if (!workspaceId) {
      return res.status(400).json({ message: 'No workspace associated with user' });
    }

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    const { name, templateName } = req.body;

    // Generate a secure random API key
    const apiKey = `wk_${crypto.randomBytes(16).toString('hex')}`;

    if (!workspace.apiKeys) {
      workspace.apiKeys = [];
    }

    const newKey = {
      key: apiKey,
      name: name || 'Default Key',
      templateName: templateName || null,
      isActive: true,
      createdAt: new Date()
    };

    workspace.apiKeys.push(newKey);
    await workspace.save();

    res.json({
      success: true,
      data: newKey
    });
  } catch (error) {
    console.error('[DeveloperController] Error generating API key:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/*
 * Get developer settings for the workspace
 */
exports.getSettings = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const workspace = await Workspace.findById(workspaceId).select('apiKeys developerSettings');

    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    // Migration: If we have an old legacy key but no new apiKeys, move it
    if (workspace.developerSettings?.apiKey && (!workspace.apiKeys || workspace.apiKeys.length === 0)) {
      workspace.apiKeys = [{
        key: workspace.developerSettings.apiKey,
        name: 'Legacy Key',
        templateName: workspace.developerSettings.authTemplateName || null,
        isActive: workspace.developerSettings.isActive !== false,
        createdAt: workspace.developerSettings.createdAt || new Date()
      }];
      // Clear legacy
      workspace.developerSettings.apiKey = null;
      await workspace.save();
    }

    res.json({
      success: true,
      data: {
        apiKeys: workspace.apiKeys || []
      }
    });
  } catch (error) {
    console.error('[DeveloperController] Error fetching settings:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/*
 * Update developer settings (e.g. set default authentication template)
 */
exports.updateSettings = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const { authTemplateName } = req.body;

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    if (!workspace.developerSettings) {
      workspace.developerSettings = { isActive: true, createdAt: new Date() };
    }

    if (authTemplateName !== undefined) {
      workspace.developerSettings.authTemplateName = authTemplateName;
    }

    await workspace.save();

    res.json({
      success: true,
      message: 'Settings updated successfully',
      data: workspace.developerSettings
    });
  } catch (error) {
    console.error('[DeveloperController] Error updating settings:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/*
 * Revoke/Disable the current API key
 */
exports.revokeApiKey = async (req, res) => {
  try {
    const { key } = req.body;
    const workspaceId = req.user.workspace;
    const workspace = await Workspace.findById(workspaceId);

    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    if (!key) {
      return res.status(400).json({ message: 'API key is required to revoke' });
    }

    // Find the key in the array
    const keyIndex = workspace.apiKeys.findIndex(k => k.key === key);
    
    if (keyIndex === -1) {
      return res.status(404).json({ message: 'API key not found in this workspace' });
    }

    // Mark as inactive
    workspace.apiKeys[keyIndex].isActive = false;
    await workspace.save();

    res.json({
      success: true,
      message: 'API key revoked successfully'
    });
  } catch (error) {
    console.error('[DeveloperController] Error revoking API key:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
