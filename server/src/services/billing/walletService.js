const { Workspace, WalletTransaction } = require('../../models');
const mongoose = require('mongoose');
const logger = require('../../utils/logger');

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * WALLET SERVICE - PRE-PAID CREDIT MANAGEMENT
 * 
 * Core logic for:
 * 1. Balance Parking: Reserving credits before campaign execution (prevent over-spend)
 * 2. Unparking/Refunds: Releasing credits for failed messages or completion
 * 3. Permanent Spending: Finalizing charges for successful sends
 * 4. Auditing: Ensuring every credit movement is traced to a transaction
 * ═══════════════════════════════════════════════════════════════════════════════
 */

/**
 * Park balance for a campaign
 * Reserves credits corresponding to the total recipient count
 * 
 * @param {ObjectId} workspaceId 
 * @param {Number} amount - Amount to park (totalRecipients * costPerRecipient)
 * @param {ObjectId} campaignId 
 * @returns {Promise<{success: boolean, balance: number}>}
 */
async function parkBalance(workspaceId, amount, campaignId) {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const workspace = await Workspace.findById(workspaceId).session(session);
    
    if (!workspace) throw new Error('WORKSPACE_NOT_FOUND');
    
    // Check if sufficient balance
    if (workspace.wallet.balance < amount) {
      throw new Error(`INSUFFICIENT_BALANCE: Found ${workspace.wallet.balance}, required ${amount} for campaign`);
    }
    
    const previousBalance = workspace.wallet.balance;
    
    // Atomically move from balance to parkedBalance
    workspace.wallet.balance -= amount;
    workspace.wallet.parkedBalance += amount;
    await workspace.save({ session });
    
    // Record transaction
    const transaction = new WalletTransaction({
      workspace: workspaceId,
      type: 'PARK',
      amount,
      previousBalance,
      newBalance: workspace.wallet.balance,
      referenceType: 'CAMPAIGN',
      referenceId: campaignId,
      description: `Credits parked for campaign start (Recipients: ${amount})`
    });
    await transaction.save({ session });
    
    await session.commitTransaction();
    logger.info(`[Wallet] Parked ${amount} credits for workspace ${workspaceId} (Campaign: ${campaignId})`);
    
    return { success: true, balance: workspace.wallet.balance };
  } catch (error) {
    await session.abortTransaction();
    logger.error(`[Wallet] parkBalance failed for workspace ${workspaceId}:`, error.message);
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Unpark balance (finalize or refund reserved credits)
 * 
 * @param {ObjectId} workspaceId 
 * @param {Number} amount - Amount to unpark
 * @param {ObjectId} campaignId 
 * @param {Boolean} isSpend - If true, deducting from parked (permanent spend), else refund to balance
 * @returns {Promise<Object>}
 */
async function unparkBalance(workspaceId, amount, campaignId, isSpend = false) {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const workspace = await Workspace.findById(workspaceId).session(session);
    if (!workspace) throw new Error('WORKSPACE_NOT_FOUND');
    
    // Ensure we don't unpark more than exists
    const actualUnpark = Math.min(amount, workspace.wallet.parkedBalance);
    
    workspace.wallet.parkedBalance -= actualUnpark;
    
    if (!isSpend) {
      // Refund to main balance
      workspace.wallet.balance += actualUnpark;
    }
    
    await workspace.save({ session });
    
    // Record transaction
    const transaction = new WalletTransaction({
      workspace: workspaceId,
      type: isSpend ? 'SPEND' : 'UNPARK',
      amount: actualUnpark,
      newBalance: workspace.wallet.balance,
      referenceType: 'CAMPAIGN',
      referenceId: campaignId,
      description: isSpend ? `Credits spent for campaign delivery` : `Credits unparked/refunded from campaign`
    });
    await transaction.save({ session });
    
    await session.commitTransaction();
    return { success: true, balance: workspace.wallet.balance };
  } catch (error) {
    await session.abortTransaction();
    logger.error(`[Wallet] unparkBalance failed:`, error.message);
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Handle individual message spend from parked balance
 * 
 * @param {ObjectId} workspaceId 
 * @param {ObjectId} campaignId 
 * @param {Number} amount (defaults to 1) 
 */
async function recordMessageDeliverability(workspaceId, campaignId, amount = 1) {
  // This is a "silent" spend from parked balance (no transaction log per message to avoid DB bloat)
  // Instead, the total reconciliation happens via unparkBalance on completion.
  // However, for high-accuracy tracking, we'll implement a batch reconciliation.
  
  return Workspace.findByIdAndUpdate(workspaceId, {
    $inc: { 'wallet.parkedBalance': -amount }
  });
}

/**
 * Get current balance
 */
async function getBalance(workspaceId) {
  const workspace = await Workspace.findById(workspaceId).select('wallet');
  return workspace?.wallet || { balance: 0, parkedBalance: 0 };
}

module.exports = {
  parkBalance,
  unparkBalance,
  recordMessageDeliverability,
  getBalance
};
