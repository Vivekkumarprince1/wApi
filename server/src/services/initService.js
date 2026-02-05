const Workspace = require('../models/Workspace');
const { ensureParentWaba } = require('./parentWabaService');

/**
 * Initialize Parent WABA credentials from environment variables.
 * Interakt-style: platform controls a SINGLE Parent WABA (no per-tenant tokens).
 */
async function initializeDefaultWABA() {
  try {
    await ensureParentWaba();
    console.log('✅ Parent WABA initialized');

    // Backfill parent/child references if any legacy workspace exists
    const legacyWorkspaces = await Workspace.find({
      bspManaged: true,
      $or: [
        { parentWaba: { $exists: false } },
        { childBusiness: { $exists: false } }
      ]
    }).select('_id');

    if (legacyWorkspaces.length > 0) {
      console.log(`🔧 Found ${legacyWorkspaces.length} BSP workspaces without child links. Backfill deferred to runtime.`);
    }
  } catch (error) {
    console.error('❌ Error during WABA auto-initialization:', error.message);
  }
}

/**
 * Update existing workspaces with new WABA credentials from environment.
 * Call this to force-update all workspaces with the latest env credentials.
 */
async function updateAllWorkspacesWABA() {
  await ensureParentWaba();
  return { modifiedCount: 0, matchedCount: 0 };
}

module.exports = {
  initializeDefaultWABA,
  updateAllWorkspacesWABA
};
