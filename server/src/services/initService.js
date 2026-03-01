const Workspace = require('../models/Workspace');

/**
 * Initialize default workspace with WABA credentials from environment variables.
 * This runs once when the server starts to ensure the workspace is ready to use.
 */
async function initializeDefaultWABA() {
  console.log('⚠️ initializeDefaultWABA is deprecated.');
  console.log('   Workspaces MUST use isolated gupshupIdentity credentials.');
  return;
}

/**
 * Update existing workspaces with new WABA credentials from environment.
 * Call this to force-update all workspaces with the latest env credentials.
 */
async function updateAllWorkspacesWABA() {
  throw new Error('updateAllWorkspacesWABA is deprecated. Each workspace must maintain its own isolated gupshupIdentity.');
}

module.exports = {
  initializeDefaultWABA,
  updateAllWorkspacesWABA
};
