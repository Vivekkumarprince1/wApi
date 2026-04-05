const { Workspace } = require('../../models');
const WalletTransaction = require('../../models/workspace/WalletTransaction');

/**
 * Park credits for a campaign
 */
async function parkBalance(workspaceId, amount, campaignId) {
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) throw new Error('Workspace not found');

  if (workspace.wallet.balance < amount) {
    throw new Error(`Insufficient wallet balance. Required: ${amount}, Available: ${workspace.wallet.balance}`);
  }

  // Atomically move from balance to parkedBalance
  workspace.wallet.balance -= amount;
  workspace.wallet.parkedBalance += amount;
  await workspace.save();

  // Record transaction
  await WalletTransaction.create({
    workspaceId,
    type: 'PARK',
    amount,
    currency: workspace.wallet.currency,
    referenceType: 'CAMPAIGN',
    referenceId: campaignId,
    referenceTypeModel: 'Campaign',
    description: `Credits parked for campaign launch`
  });

  return true;
}

/**
 * Reconcile parked balance (unpark unused credits)
 */
async function unparkBalance(workspaceId, amount, campaignId) {
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) return;

  const actualUnpark = Math.min(amount, workspace.wallet.parkedBalance);
  workspace.wallet.parkedBalance -= actualUnpark;
  workspace.wallet.balance += actualUnpark;
  await workspace.save();

  await WalletTransaction.create({
    workspaceId,
    type: 'UNPARK',
    amount: actualUnpark,
    currency: workspace.wallet.currency,
    referenceType: 'CAMPAIGN',
    referenceId: campaignId,
    referenceTypeModel: 'Campaign',
    description: `Unused credits refunded to wallet`
  });
}

/**
 * Finalize credit spend (convert parked to spent)
 */
async function recordMessageDeliverability(workspaceId, campaignId, success) {
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) return;

  if (success) {
    // Just reduce parked balance (it's already deducted from balance)
    workspace.wallet.parkedBalance = Math.max(0, workspace.wallet.parkedBalance - 1);
    await workspace.save();

    await WalletTransaction.create({
      workspaceId,
      type: 'SPEND',
      amount: 1,
      currency: workspace.wallet.currency,
      referenceType: 'CAMPAIGN',
      referenceId: campaignId,
      referenceTypeModel: 'Campaign',
      description: `Credit spent on successful delivery`
    });
  } else {
    // Refund 1 credit if failure and no fallback
    workspace.wallet.parkedBalance = Math.max(0, workspace.wallet.parkedBalance - 1);
    workspace.wallet.balance += 1;
    await workspace.save();

    await WalletTransaction.create({
      workspaceId,
      type: 'REFUND',
      amount: 1,
      currency: workspace.wallet.currency,
      referenceType: 'CAMPAIGN',
      referenceId: campaignId,
      referenceTypeModel: 'Campaign',
      description: `Credit refunded due to delivery failure`
    });
  }
}

module.exports = {
  parkBalance,
  unparkBalance,
  recordMessageDeliverability
};
