const { Workspace, WalletTransaction } = require('../../models');
const logger = require('../../utils/logger');
const mongoose = require('mongoose');

/**
 * Wallet Service - Implementation for Pre-paid billing
 * Handles balance management, deduction, and transaction history.
 */
class WalletService {
  /**
   * Add funds to a workspace wallet
   * @param {string} workspaceId 
   * @param {number} amountPaise 
   * @param {Object} metadata { referenceType, referenceId, description }
   */
  async credit(workspaceId, amountPaise, metadata = {}) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const workspace = await Workspace.findById(workspaceId).session(session);
      if (!workspace) throw new Error('Workspace not found');

      // Update balance
      if (!workspace.wallet) workspace.wallet = { balance: 0 };
      workspace.wallet.balance = (workspace.wallet.balance || 0) + amountPaise;
      workspace.wallet.lastRechargeAt = new Date();
      
      await workspace.save({ session });

      // Record transaction
      const transaction = new WalletTransaction({
        workspace: workspaceId,
        type: 'RECHARGE',
        amount: amountPaise,
        referenceType: metadata.referenceType || 'SYSTEM',
        referenceId: metadata.referenceId,
        status: 'COMPLETED',
        description: metadata.description || 'Wallet Recharge',
        metadata: metadata.metadata
      });
      await transaction.save({ session });

      await session.commitTransaction();
      logger.info(`[WalletService] Credited ${amountPaise} paise to Workspace ${workspaceId}`);
      return { success: true, newBalance: workspace.balance };
    } catch (error) {
      await session.abortTransaction();
      logger.error('[WalletService] Credit failed:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Deduct funds from a workspace wallet
   * @param {string} workspaceId 
   * @param {number} amountPaise 
   * @param {Object} metadata { type, referenceType, referenceId, description }
   */
  async deduct(workspaceId, amountPaise, metadata = {}) {
    if (amountPaise <= 0) return { success: true };

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const workspace = await Workspace.findById(workspaceId).session(session);
      if (!workspace) throw new Error('Workspace not found');

      // Update balance
      if (!workspace.wallet) workspace.wallet = { balance: 0 };
      const currentBalance = workspace.wallet.balance || 0;
      if (currentBalance < amountPaise) {
        throw new Error(`INSUFFICIENT_BALANCE: Required ${amountPaise}, current ${currentBalance}`);
      }

      workspace.wallet.balance = currentBalance - amountPaise;
      await workspace.save({ session });

      // Record transaction
      const transaction = new WalletTransaction({
        workspace: workspaceId,
        type: metadata.type || 'SPEND',
        amount: amountPaise,
        referenceType: metadata.referenceType || 'SYSTEM',
        referenceId: metadata.referenceId,
        status: 'COMPLETED',
        description: metadata.description || 'Message Consumption',
        metadata: metadata.metadata
      });
      await transaction.save({ session });

      await session.commitTransaction();
      logger.info(`[WalletService] Deducted ${amountPaise} paise from Workspace ${workspaceId}`);
      return { success: true, newBalance: workspace.balance };
    } catch (error) {
      await session.abortTransaction();
      if (!error.message.includes('INSUFFICIENT_BALANCE')) {
        logger.error('[WalletService] Deduction failed:', error);
      }
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get wallet balance
   */
  async getBalance(workspaceId) {
    const workspace = await Workspace.findById(workspaceId).select('wallet');
    return {
      balance: workspace?.wallet?.balance || 0
    };
  }

  /**
   * Get balance and status
   */
  async getStatus(workspaceId) {
    const workspace = await Workspace.findById(workspaceId).select('wallet');
    if (!workspace) throw new Error('Workspace not found');
    
    const wallet = workspace.wallet || { balance: 0, thresholdAmount: 500 };
    return {
      balance: wallet.balance || 0,
      isLow: (wallet.balance || 0) < (wallet.thresholdAmount || 500),
      threshold: wallet.thresholdAmount || 500
    };
  }

  /**
   * Get transaction history
   */
  async getTransactions(workspaceId, limit = 20, offset = 0) {
    const transactions = await WalletTransaction.find({ workspace: workspaceId })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit);
    
    const total = await WalletTransaction.countDocuments({ workspaceId });
    
    return {
      transactions,
      total,
      hasMore: offset + limit < total
    };
  }

  /**
   * Record a plan subscription payment in the ledger
   * @param {string} workspaceId 
   * @param {string} planId 
   * @param {number} amountPaise 
   * @param {string} providerId (Razorpay order/sub id)
   */
  async recordPlanPurchase(workspaceId, planId, amountPaise, providerId, planName) {
    try {
      const transaction = new WalletTransaction({
        workspace: workspaceId,
        type: 'SUBSCRIPTION_PURCHASE',
        amount: amountPaise,
        referenceType: 'SUBSCRIPTION',
        referenceId: planId,
        status: 'COMPLETED',
        description: `Plan Purchase: ${planName || 'Pro'}`,
        metadata: { providerId }
      });
      await transaction.save();
      logger.info(`[WalletService] Recorded subscription ledger for Workspace ${workspaceId}: ${planName}`);
    } catch (error) {
      logger.error('[WalletService] recordPlanPurchase failed:', error);
      // Non-blocking error for main activation logic
    }
  }
}

module.exports = new WalletService();
