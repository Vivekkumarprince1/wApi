const ParentWABA = require('../models/ParentWABA');
const bspConfig = require('../config/bspConfig');
const { storeToken, retrieveToken } = require('./secretsManager');

let cachedParent = null;
let cachedToken = null;

/**
 * Ensure a single Parent WABA record exists.
 * This centralizes Meta credentials under platform control.
 */
async function ensureParentWaba() {
  if (!bspConfig.parentWabaId) {
    throw new Error('META_WABA_ID_NOT_CONFIGURED');
  }

  let parent = await ParentWABA.findOne({ wabaId: bspConfig.parentWabaId });
  const shouldUpdate = !parent ||
    parent.businessId !== bspConfig.parentBusinessId ||
    parent.appId !== bspConfig.appId ||
    parent.configId !== bspConfig.configId ||
    parent.webhookVerifyToken !== bspConfig.webhookVerifyToken ||
    parent.apiVersion !== bspConfig.apiVersion;

  if (!parent) {
    parent = await ParentWABA.create({
      name: 'Primary Parent WABA',
      wabaId: bspConfig.parentWabaId,
      businessId: bspConfig.parentBusinessId,
      appId: bspConfig.appId,
      configId: bspConfig.configId,
      webhookVerifyToken: bspConfig.webhookVerifyToken,
      apiVersion: bspConfig.apiVersion,
      active: true
    });
  } else if (shouldUpdate) {
    parent.businessId = bspConfig.parentBusinessId || parent.businessId;
    parent.appId = bspConfig.appId || parent.appId;
    parent.configId = bspConfig.configId || parent.configId;
    parent.webhookVerifyToken = bspConfig.webhookVerifyToken || parent.webhookVerifyToken;
    parent.apiVersion = bspConfig.apiVersion || parent.apiVersion;
    await parent.save();
  }

  // Store system user token in vault if not already stored
  if (bspConfig.systemUserToken && !parent.systemUserTokenRef) {
    const stored = await storeToken('parent-waba', 'systemUserToken', bspConfig.systemUserToken);
    parent.systemUserTokenRef = stored.location === 'local' ? stored.encryptedValue : parent.systemUserTokenRef;
    await parent.save();
  }

  cachedParent = parent;
  return parent;
}

/**
 * Get active Parent WABA (singleton).
 */
async function getParentWaba() {
  if (cachedParent) return cachedParent;
  const parent = await ParentWABA.findOne({ active: true }).sort({ createdAt: -1 });
  if (parent) {
    cachedParent = parent;
    return parent;
  }
  return ensureParentWaba();
}

/**
 * Retrieve system user token for Parent WABA from vault.
 */
async function getSystemUserToken() {
  if (cachedToken) return cachedToken;

  const parent = await getParentWaba();
  const tokenRef = parent?.systemUserTokenRef;
  if (!tokenRef && bspConfig.systemUserToken) {
    const stored = await storeToken('parent-waba', 'systemUserToken', bspConfig.systemUserToken);
    cachedToken = stored.location === 'local' ? stored.encryptedValue : bspConfig.systemUserToken;
    parent.systemUserTokenRef = stored.location === 'local' ? stored.encryptedValue : parent.systemUserTokenRef;
    await parent.save();
    return bspConfig.systemUserToken;
  }

  cachedToken = await retrieveToken('parent-waba', 'systemUserToken', tokenRef);
  if (!cachedToken) {
    throw new Error('BSP_TOKEN_NOT_CONFIGURED');
  }

  return cachedToken;
}

module.exports = {
  ensureParentWaba,
  getParentWaba,
  getSystemUserToken
};
