const { Workspace } = require('../../models');
const WalletTransaction = require('../../models/workspace/WalletTransaction');
const inboxSocketService = require('../messaging/inboxSocketService');

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

  // Emit real-time update
  inboxSocketService.emitWalletUpdate(workspaceId, workspace.wallet);

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

  // Emit real-time update
  inboxSocketService.emitWalletUpdate(workspaceId, workspace.wallet);

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
 * Finalize credit spend for a campaign message (Conversation-Aware)
 * 
 * Rules:
 * 1. If message failed → Refund 1 parked credit
 * 2. If message succeeded BUT no new conversation started (active window) → Refund 1 parked credit
 * 3. If message succeeded AND started new billable conversation → Keep 1 credit spent
 * 
 * @param {ObjectId} workspaceId 
 * @param {String} whatsappMessageId 
 * @param {ObjectId} campaignId 
 * @param {Boolean} success 
 */
async function finalizeConversationSpend(workspaceId, whatsappMessageId, campaignId, success) {
  const billingLedgerService = require('../billing/billingLedgerService');
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) return;

  const { billable } = await billingLedgerService.wasMessageBillable(whatsappMessageId);

  // Determine if we should actually charge for this message
  // We only charge if it was a SUCCESSFUL delivery that started a NEW BILLABLE window
  const shouldCharge = success && billable;

  if (shouldCharge) {
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
      description: `Conversation credit spent (Meta Window started)`
    });

    console.log(`[WalletService] Credit SPENT for ${whatsappMessageId} (Window started)`);
  } else {
    // Refund 1 credit (either it failed, or it was free/within-window)
    const refundReason = !success ? 'Delivery failure' : 'Active window (no new charge)';
    
    workspace.wallet.parkedBalance = Math.max(0, workspace.wallet.parkedBalance - 1);
    workspace.wallet.balance += 1;
    await workspace.save();

    // Emit real-time update
    inboxSocketService.emitWalletUpdate(workspaceId, workspace.wallet);

    await WalletTransaction.create({
      workspaceId,
      type: 'REFUND',
      amount: 1,
      currency: workspace.wallet.currency,
      referenceType: 'CAMPAIGN',
      referenceId: campaignId,
      referenceTypeModel: 'Campaign',
      description: `Credit refunded: ${refundReason}`
    });

    console.log(`[WalletService] Credit REFUNDED for ${whatsappMessageId} (${refundReason})`);
  }
}

module.exports = {
  parkBalance,
  unparkBalance,
  finalizeConversationSpend,
  // Legacy support for other modules
  recordMessageDeliverability: finalizeConversationSpend 
};
