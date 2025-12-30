const User = require('../models/User');
const Workspace = require('../models/Workspace');

// Models to remove by workspace
const modelsToPurge = [
  'Contact', 'Message', 'Order', 'Campaign', 'CampaignMessage', 'CheckoutCart',
  'CommerceSettings', 'Conversation', 'Template', 'WhatsAppFormResponse', 'WhatsAppForm',
  'Product', 'Deal', 'Pipeline', 'WorkflowExecution', 'WebhookLog', 'InstagramQuickflow',
  'InstagramQuickflowLog', 'AutoReply', 'AutoReplyLog', 'AnswerBotSource', 'Integration'
];

async function purgeWorkspaceData(workspaceId) {
  const results = {};
  for (const name of modelsToPurge) {
    try {
      // require dynamically
      // Some models may not exist in all deployments; skip if missing
      // eslint-disable-next-line import/no-dynamic-require, global-require
      const Model = require(`../models/${name}`);
      // Many models store a `workspace` ObjectId
      const res = await Model.deleteMany({ workspace: workspaceId });
      results[name] = { deletedCount: res.deletedCount || 0 };
    } catch (err) {
      // ignore missing models or errors but log
      results[name] = { error: err.message };
    }
  }
  return results;
}

// Authenticated user deletes their account and workspace
exports.deleteAccount = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const workspaceId = user.workspace;

    // Purge workspace-scoped data
    if (workspaceId) {
      await purgeWorkspaceData(workspaceId);
      // delete workspace document
      await Workspace.deleteOne({ _id: workspaceId });
    }

    // delete user
    await User.deleteOne({ _id: user._id });

    // NOTE: You may want to invalidate tokens/sessions here if you store them

    return res.json({ success: true, message: 'Account and workspace data deleted' });
  } catch (err) {
    next(err);
  }
};

// Public callback endpoint for Meta data deletion requests
// Accepts JSON payload from Meta or third-parties and attempts to delete matching user data
exports.metaDataDeletionCallback = async (req, res, next) => {
  try {
    const body = req.body || {};
    // Try to identify user by email, phone, or id fields provided in the callback
    const { email, phone, id } = body;

    let user = null;
    if (email) user = await User.findOne({ email });
    if (!user && phone) user = await User.findOne({ phone });
    if (!user && id) user = await User.findOne({ $or: [{ facebookId: id }, { googleId: id }] });

    if (user) {
      const workspaceId = user.workspace;
      if (workspaceId) await purgeWorkspaceData(workspaceId);
      await Workspace.deleteOne({ _id: workspaceId });
      await User.deleteOne({ _id: user._id });
      return res.json({ success: true, status: 'deleted' });
    }

    // If user not found, respond with instructions URL for manual deletion
    const instructionsUrl = process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL.replace(/\/$/, '')}/privacy/data-deletion-instructions` : `${req.protocol}://${req.get('host')}/privacy/data-deletion-instructions`;
    return res.json({ success: false, message: 'User not found', instructions_url: instructionsUrl });
  } catch (err) {
    next(err);
  }
};
