require('dotenv').config();
const mongoose = require('mongoose');
const { Workspace } = require('../src/models');
const gupshupService = require('../src/services/bsp/gupshupService');
const { decryptToken } = require('../src/services/bsp/gupshupProvisioningService');

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  await mongoose.connect(uri);

  const workspaceId = process.argv[2];
  if (!workspaceId) throw new Error('WORKSPACE_ID_REQUIRED');

  const workspace = await Workspace.findById(workspaceId).lean();
  if (!workspace) throw new Error('WORKSPACE_NOT_FOUND');

  const appId = workspace.gupshupIdentity?.partnerAppId || workspace.gupshupAppId;
  const encryptedApiKey = workspace.gupshupIdentity?.appApiKey;
  const appApiKey = decryptToken(encryptedApiKey);

  if (!appId) throw new Error('APP_ID_NOT_FOUND');
  if (!appApiKey) throw new Error('APP_API_KEY_NOT_FOUND');

  const subscriptions = await gupshupService.listSubscriptions({ appId, appApiKey });
  console.log(JSON.stringify({ appId, subscriptions }, null, 2));

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
