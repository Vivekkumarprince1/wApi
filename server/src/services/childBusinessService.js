const ChildBusiness = require('../models/ChildBusiness');
const Workspace = require('../models/Workspace');
const { getParentWaba } = require('./parentWabaService');

const LEGACY_TO_LIFECYCLE = {
  PENDING: 'pending',
  CONNECTED: 'active',
  ACTIVE: 'active',
  DISCONNECTED: 'disabled',
  BANNED: 'disabled',
  FLAGGED: 'restricted',
  RATE_LIMITED: 'restricted',
  RESTRICTED: 'restricted',
  SUSPENDED: 'disabled'
};

function normalizeLifecycleStatus({ rawStatus, codeVerificationStatus, nameStatus }) {
  const normalized = rawStatus ? rawStatus.toString().toUpperCase() : null;
  if (normalized && LEGACY_TO_LIFECYCLE[normalized]) return LEGACY_TO_LIFECYCLE[normalized];

  if (nameStatus && nameStatus.toString().toUpperCase() === 'APPROVED') {
    return 'display_name_approved';
  }
  if (codeVerificationStatus && codeVerificationStatus.toString().toUpperCase() === 'VERIFIED') {
    return 'verified';
  }
  return 'pending';
}

async function createOrUpdateChildBusinessFromWorkspace(workspace) {
  if (!workspace) return null;

  const parent = await getParentWaba();
  if (!parent) throw new Error('PARENT_WABA_NOT_FOUND');

  const phoneNumberId = workspace.bspPhoneNumberId || workspace.phoneNumberId || workspace.whatsappPhoneNumberId;
  if (!phoneNumberId) return null;

  let child = await ChildBusiness.findOne({ phoneNumberId });

  const lifecycleStatus = normalizeLifecycleStatus({
    rawStatus: workspace.bspPhoneStatus,
    codeVerificationStatus: workspace.codeVerificationStatus,
    nameStatus: workspace.nameStatus
  });

  const payload = {
    workspace: workspace._id,
    parentWaba: parent._id,
    customerBusinessId: workspace.businessId,
    wabaId: parent.wabaId,
    childWabaId: workspace.childWabaId || workspace.wabaId,
    parentWabaId: parent.wabaId,
    phoneNumberId,
    displayPhoneNumber: workspace.bspDisplayPhoneNumber || workspace.whatsappPhoneNumber,
    verifiedName: workspace.bspVerifiedName || workspace.verifiedName,
    phoneStatus: lifecycleStatus,
    qualityRating: workspace.bspQualityRating || workspace.qualityRating || 'UNKNOWN',
    messagingLimitTier: workspace.bspMessagingTier || workspace.messagingLimitTier,
    codeVerificationStatus: workspace.codeVerificationStatus,
    nameStatus: workspace.nameStatus,
    isOfficialAccount: workspace.isOfficialAccount || false,
    accountMode: workspace.accountMode
  };

  if (!child) {
    child = await ChildBusiness.create({
      ...payload,
      lastStatusUpdateAt: new Date(),
      lastQualityUpdateAt: new Date()
    });
  } else {
    Object.assign(child, payload, {
      lastStatusUpdateAt: new Date(),
      lastQualityUpdateAt: new Date()
    });
    await child.save();
  }

  await Workspace.findByIdAndUpdate(workspace._id, {
    parentWaba: parent._id,
    childBusiness: child._id
  });

  return child;
}

async function createOrUpdateFromOnboarding({
  workspaceId,
  businessId,
  wabaId,
  phoneNumberId,
  displayPhoneNumber,
  verifiedName,
  qualityRating,
  messagingLimitTier,
  codeVerificationStatus,
  nameStatus,
  accountMode,
  phoneStatusRaw,
  webhooksSubscribedAt
}) {
  const parent = await getParentWaba();
  if (!parent) throw new Error('PARENT_WABA_NOT_FOUND');

  const lifecycleStatus = normalizeLifecycleStatus({
    rawStatus: phoneStatusRaw,
    codeVerificationStatus,
    nameStatus
  });

  let child = await ChildBusiness.findOne({ phoneNumberId });

  const payload = {
    workspace: workspaceId,
    parentWaba: parent._id,
    customerBusinessId: businessId,
    wabaId: parent.wabaId,
    childWabaId: wabaId,
    parentWabaId: parent.wabaId,
    phoneNumberId,
    displayPhoneNumber,
    verifiedName,
    phoneStatus: lifecycleStatus,
    statusReason: phoneStatusRaw,
    qualityRating: qualityRating || 'UNKNOWN',
    messagingLimitTier,
    codeVerificationStatus,
    nameStatus,
    isOfficialAccount: false,
    accountMode,
    webhooksSubscribedAt: webhooksSubscribedAt || null,
    lastStatusUpdateAt: new Date(),
    lastQualityUpdateAt: new Date()
  };

  if (!child) {
    child = await ChildBusiness.create(payload);
  } else {
    Object.assign(child, payload);
    await child.save();
  }

  await Workspace.findByIdAndUpdate(workspaceId, {
    parentWaba: parent._id,
    childBusiness: child._id
  });

  return child;
}

async function getChildBusinessForWorkspace(workspaceId) {
  return ChildBusiness.findOne({ workspace: workspaceId }).populate('parentWaba');
}

async function getActiveChildBusinessForWorkspace(workspaceId) {
  const child = await getChildBusinessForWorkspace(workspaceId);
  if (!child) throw new Error('CHILD_BUSINESS_NOT_FOUND');
  if (child.phoneStatus !== 'active') {
    const err = new Error('PHONE_NOT_ACTIVE');
    err.code = 'PHONE_NOT_ACTIVE';
    err.phoneStatus = child.phoneStatus;
    throw err;
  }
  return child;
}

async function updateChildBusinessByPhoneNumberId(phoneNumberId, updates = {}) {
  if (!phoneNumberId) return null;
  const child = await ChildBusiness.findOne({ phoneNumberId });
  if (!child) return null;

  if (updates.phoneStatusRaw || updates.codeVerificationStatus || updates.nameStatus) {
    child.phoneStatus = normalizeLifecycleStatus({
      rawStatus: updates.phoneStatusRaw,
      codeVerificationStatus: updates.codeVerificationStatus,
      nameStatus: updates.nameStatus
    });
    child.statusReason = updates.phoneStatusRaw || child.statusReason;
    child.lastStatusUpdateAt = new Date();
  }

  if (updates.qualityRating) {
    child.qualityRating = updates.qualityRating;
    child.lastQualityUpdateAt = new Date();
  }

  if (updates.messagingLimitTier) child.messagingLimitTier = updates.messagingLimitTier;
  if (updates.displayPhoneNumber) child.displayPhoneNumber = updates.displayPhoneNumber;
  if (updates.verifiedName) child.verifiedName = updates.verifiedName;

  await child.save();
  return child;
}

module.exports = {
  normalizeLifecycleStatus,
  createOrUpdateFromOnboarding,
  createOrUpdateChildBusinessFromWorkspace,
  getChildBusinessForWorkspace,
  getActiveChildBusinessForWorkspace,
  updateChildBusinessByPhoneNumberId
};
