const { Subscription, Workspace } = require('../../models');

const BLOCKED_STATUSES = {
  trialing: 'BILLING_TRIAL_NO_SEND',
  past_due: 'BILLING_PAST_DUE',
  suspended: 'BILLING_SUSPENDED'
};

async function enforceWorkspaceBilling(workspaceId) {
  if (process.env.BILLING_ENFORCEMENT_DISABLED === 'true') {
    return { status: 'disabled', subscription: null };
  }

  const subscription = await Subscription.findOne({ workspace: workspaceId })
    .sort({ createdAt: -1 })
    .lean();

  const workspace = subscription
    ? null
    : await Workspace.findById(workspaceId).select('billingStatus').lean();

  const status =
    subscription?.status ||
    workspace?.billingStatus ||
    'trialing';

  if (BLOCKED_STATUSES[status]) {
    const error = new Error(BLOCKED_STATUSES[status]);
    error.code = BLOCKED_STATUSES[status];
    error.status = status;
    throw error;
  }

  if (subscription?.status && subscription?.status !== 'canceled') {
    await Workspace.findByIdAndUpdate(workspaceId, {
      $set: { billingStatus: subscription.status }
    }).catch(() => null);
  }

  return { status, subscription };
}

module.exports = {
  enforceWorkspaceBilling,
  BLOCKED_STATUSES
};
