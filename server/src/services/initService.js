const Workspace = require('../models/Workspace');

/**
 * Initialize default workspace with WABA credentials from environment variables.
 * This runs once when the server starts to ensure the workspace is ready to use.
 */
async function initializeDefaultWABA() {
  const accessToken = process.env.META_ACCESS_TOKEN;
  const wabaId = process.env.META_WABA_ID;
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
  const verifyToken = process.env.META_VERIFY_TOKEN;

  if (!accessToken || !wabaId || !phoneNumberId) {
    console.log('⚠️  WABA credentials not found in environment variables. Skipping auto-initialization.');
    console.log('   Set META_ACCESS_TOKEN, META_WABA_ID, and META_PHONE_NUMBER_ID in .env file.');
    return;
  }

  try {
    // Find all workspaces that don't have WABA configured
    const workspaces = await Workspace.find({
      $or: [
        { whatsappAccessToken: { $exists: false } },
        { whatsappAccessToken: null },
        { whatsappAccessToken: '' }
      ]
    });

    if (workspaces.length === 0) {
      console.log('✅ All workspaces already have WABA credentials configured.');
      return;
    }

    console.log(`🔧 Found ${workspaces.length} workspace(s) without WABA credentials. Initializing...`);

    for (const workspace of workspaces) {
      workspace.whatsappAccessToken = accessToken;
      workspace.wabaId = wabaId;
      workspace.whatsappPhoneNumberId = phoneNumberId;
      workspace.whatsappVerifyToken = verifyToken || 'default-verify-token';
      workspace.connectedAt = new Date();
      
      await workspace.save();
      console.log(`   ✅ Initialized WABA for workspace: ${workspace.name} (${workspace._id})`);
    }

    console.log('✅ WABA auto-initialization complete!');
  } catch (error) {
    console.error('❌ Error during WABA auto-initialization:', error.message);
  }
}

/**
 * Update existing workspaces with new WABA credentials from environment.
 * Call this to force-update all workspaces with the latest env credentials.
 */
async function updateAllWorkspacesWABA() {
  const accessToken = process.env.META_ACCESS_TOKEN;
  const wabaId = process.env.META_WABA_ID;
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
  const verifyToken = process.env.META_VERIFY_TOKEN;

  if (!accessToken || !wabaId || !phoneNumberId) {
    throw new Error('Missing required META environment variables');
  }

  const result = await Workspace.updateMany(
    {},
    {
      $set: {
        whatsappAccessToken: accessToken,
        wabaId: wabaId,
        whatsappPhoneNumberId: phoneNumberId,
        whatsappVerifyToken: verifyToken || 'default-verify-token',
        connectedAt: new Date()
      }
    }
  );

  return {
    modifiedCount: result.modifiedCount,
    matchedCount: result.matchedCount
  };
}

module.exports = {
  initializeDefaultWABA,
  updateAllWorkspacesWABA
};
