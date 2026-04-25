/**
 * HARDENED LEDGER SERVICE
 * 
 * High-reliability financial operations for the workspace wallet.
 * Uses ACID transactions to ensure ledger consistency.
 */

import { Workspace } from "@/lib/models/workspace/Workspace";
import { WalletTransaction } from "@/lib/models/billing/WalletTransaction";
import mongoose, { Types } from "mongoose";
import dbConnect from "@/lib/db-connect";

export class LedgerService {
  /**
   * Deduct credits from a workspace wallet
   */
  static async deduct(
    workspaceId: string | Types.ObjectId, 
    amountPaise: number, 
    metadata: { 
      type: string; 
      referenceType: string; 
      referenceId?: string; 
      description: string;
    }
  ): Promise<{ success: boolean; newBalance: number }> {
    if (amountPaise <= 0) return { success: true, newBalance: 0 };
    await dbConnect();
    const session = await mongoose.startSession();

    try {
      return await session.withTransaction(async () => {
        console.log(`[Ledger:Deduct] Processing deduction for workspace ${workspaceId}...`);
        const workspace = await Workspace.findById(workspaceId).session(session);
        if (!workspace) throw new Error('WORKSPACE_NOT_FOUND');

        const previousBalance = workspace.walletBalance || 0;
        if (previousBalance < amountPaise) {
          throw new Error(`INSUFFICIENT_BALANCE: Req ${amountPaise}, Have ${previousBalance}`);
        }

        const newBalance = previousBalance - amountPaise;
        workspace.walletBalance = newBalance;
        
        // Ensure nested wallet object exists and sync balance
        if (!workspace.wallet) {
          workspace.wallet = { balance: newBalance, parkedBalance: 0, currency: 'INR', thresholdAmount: 500 };
        } else {
          workspace.wallet.balance = newBalance;
        }
        
        await workspace.save({ session });

        // Create Ledger Entry
        await WalletTransaction.create([{
          workspace: workspaceId,
          type: metadata.type || 'SPEND',
          amount: amountPaise,
          previousBalance,
          newBalance,
          referenceType: metadata.referenceType,
          referenceId: metadata.referenceId ? new Types.ObjectId(metadata.referenceId) : undefined,
          status: 'COMPLETED',
          description: metadata.description
        }], { session });

        // Emit Real-time Update
        const { broadcastToWorkspace } = require('../socket-emitter');
        broadcastToWorkspace(workspaceId.toString(), "workspace:wallet_update", { balance: newBalance });

        return { success: true, newBalance };
      });
    } catch (err: any) {
      console.error(`[Ledger:Deduct Error]:`, err.message || err);
      throw err;
    } finally {
      session.endSession();
    }
  }

  static async credit(
    workspaceId: string | Types.ObjectId,
    amountPaise: number,
    metadata: {
      type: string;
      referenceType: string;
      referenceId?: string;
      description: string;
      externalReferenceId?: string; // New: For idempotency
    }
  ): Promise<{ success: boolean; newBalance: number }> {
    await dbConnect();
    const session = await mongoose.startSession();

    try {
      return await session.withTransaction(async () => {
        // 1. Idempotency Check: Prevent duplicate credits for the same external ID
        if (metadata.externalReferenceId) {
          const existing = await WalletTransaction.findOne({ 
            externalReferenceId: metadata.externalReferenceId 
          }).session(session);
          
          if (existing) {
             const ws = await Workspace.findById(workspaceId).session(session);
             return { success: true, newBalance: ws?.walletBalance || 0 };
          }
        }

        const workspace = await Workspace.findById(workspaceId).session(session);
        if (!workspace) throw new Error('WORKSPACE_NOT_FOUND');

        const previousBalance = workspace.walletBalance || 0;
        const newBalance = previousBalance + amountPaise;
        workspace.walletBalance = newBalance;
        
        // Ensure nested wallet object exists and sync balance
        if (!workspace.wallet) {
          workspace.wallet = { balance: newBalance, parkedBalance: 0, currency: 'INR', thresholdAmount: 500 };
        } else {
          workspace.wallet.balance = newBalance;
        }
        
        await workspace.save({ session });

        await WalletTransaction.create([{
          workspace: workspaceId,
          type: metadata.type || 'RECHARGE',
          amount: amountPaise,
          previousBalance,
          newBalance,
          referenceType: metadata.referenceType,
          referenceId: metadata.referenceId ? new Types.ObjectId(metadata.referenceId) : undefined,
          externalReferenceId: metadata.externalReferenceId, // Save the reference
          status: 'COMPLETED',
          description: metadata.description
        }], { session });

        // Emit Real-time Update
        const { broadcastToWorkspace } = require('../socket-emitter');
        broadcastToWorkspace(workspaceId.toString(), "workspace:wallet_update", { balance: newBalance });

        return { success: true, newBalance };
      });
    } catch (err: any) {
      console.error(`[Ledger:Credit Error]:`, err.message || err);
      throw err;
    } finally {
      session.endSession();
    }
  }

  /**
   * Park credits for a campaign to prevent overspending
   */
  static async park(workspaceId: string | Types.ObjectId, amountPaise: number, campaignId: string): Promise<boolean> {
    await dbConnect();
    const session = await mongoose.startSession();

    try {
      return await session.withTransaction(async () => {
        const workspace = await Workspace.findById(workspaceId).session(session);
        if (!workspace) throw new Error('WORKSPACE_NOT_FOUND');

        const balance = Math.max(workspace.walletBalance || 0, workspace.wallet?.balance || 0);
        if (balance < amountPaise) throw new Error('INSUFFICIENT_BALANCE_FOR_PARK');

        workspace.walletBalance = balance - amountPaise;
        workspace.walletParkedBalance = (workspace.walletParkedBalance || 0) + amountPaise;
        
        // Sync nested wallet
        if (!workspace.wallet) {
          workspace.wallet = { 
            balance: workspace.walletBalance, 
            parkedBalance: workspace.walletParkedBalance, 
            currency: 'INR', 
            thresholdAmount: 500 
          };
        } else {
          workspace.wallet.balance = workspace.walletBalance;
          workspace.wallet.parkedBalance = workspace.walletParkedBalance;
        }
        
        await workspace.save({ session });

        await WalletTransaction.create([{
          workspace: workspaceId,
          type: 'PARK',
          amount: amountPaise,
          previousBalance: balance,
          newBalance: workspace.walletBalance,
          referenceType: 'CAMPAIGN',
          referenceId: new Types.ObjectId(campaignId),
          status: 'COMPLETED',
          description: `Credits parked for campaign: ${campaignId}`
        }], { session });

        // Emit Real-time Update
        const { broadcastToWorkspace } = require('../socket-emitter');
        broadcastToWorkspace(workspaceId.toString(), "workspace:wallet_update", { balance: workspace.walletBalance, parkedBalance: workspace.walletParkedBalance });

        return true;
      });
    } catch (err: any) {
      console.error(`[Ledger:Park Error]:`, err.message || err);
      throw err;
    } finally {
      session.endSession();
    }
  }

  /**
   * Unpark unused campaign credits
   */
  static async unpark(workspaceId: string | Types.ObjectId, amountPaise: number, campaignId: string): Promise<boolean> {
    await dbConnect();
    const session = await mongoose.startSession();

    try {
      return await session.withTransaction(async () => {
        const workspace = await Workspace.findById(workspaceId).session(session);
        if (!workspace) throw new Error('WORKSPACE_NOT_FOUND');

        const parked = workspace.walletParkedBalance || 0;
        const refund = Math.min(amountPaise, parked);

        workspace.walletParkedBalance = parked - refund;
        workspace.walletBalance = (workspace.walletBalance || 0) + refund;
        
        // Sync nested wallet
        if (!workspace.wallet) {
          workspace.wallet = { 
            balance: workspace.walletBalance, 
            parkedBalance: workspace.walletParkedBalance, 
            currency: 'INR', 
            thresholdAmount: 500 
          };
        } else {
          workspace.wallet.balance = workspace.walletBalance;
          workspace.wallet.parkedBalance = workspace.walletParkedBalance;
        }
        
        await workspace.save({ session });

        await WalletTransaction.create([{
          workspace: workspaceId,
          type: 'UNPARK',
          amount: refund,
          previousBalance: workspace.walletBalance - refund,
          newBalance: workspace.walletBalance,
          referenceType: 'CAMPAIGN',
          referenceId: new Types.ObjectId(campaignId),
          status: 'COMPLETED',
          description: `Unused credits released from campaign: ${campaignId}`
        }], { session });

        // Emit Real-time Update
        const { broadcastToWorkspace } = require('../socket-emitter');
        broadcastToWorkspace(workspaceId.toString(), "workspace:wallet_update", { balance: workspace.walletBalance, parkedBalance: workspace.walletParkedBalance });

        return true;
      });
    } catch (err: any) {
      console.error(`[Ledger:Unpark Error]:`, err.message || err);
      throw err;
    } finally {
      session.endSession();
    }
  }

  /**
   * Ensure workspace has sufficient wallet balance
   */
  static async ensureWalletBalance(workspaceId: string | Types.ObjectId, amountPaise: number): Promise<boolean> {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) throw new Error('WORKSPACE_NOT_FOUND');
    
    const balance = Math.max(workspace.walletBalance || 0, workspace.wallet?.balance || 0);
    if (balance < amountPaise) {
      throw new Error('INSUFFICIENT_BALANCE');
    }
    return true;
  }

  /**
   * Finalize and settle a campaign: release remaining parked funds
   */
  static async resolveCampaign(
    workspaceId: string | Types.ObjectId,
    successAmount: number,
    failAmount: number,
    campaignId: string
  ): Promise<boolean> {
    await dbConnect();
    const session = await mongoose.startSession();

    try {
      return await session.withTransaction(async () => {
        console.log(`[Ledger:ResolveCampaign] Settling campaign ${campaignId} for workspace ${workspaceId}...`);
        const workspace = await Workspace.findById(workspaceId).session(session);
        if (!workspace) throw new Error('WORKSPACE_NOT_FOUND');

        const parked = workspace.walletParkedBalance || 0;
        const actualSpent = successAmount; // The amount actually spent out of the reservation
        
        /**
         * SETTLEMENT LOGIC:
         * 1. Calculate the difference between what was reserved (parked) and what was actually spent.
         * 2. If saved > 0 (parked > spent), we refund the difference back to the main balance.
         * 3. If saved < 0 (spent > parked), we deduct the overage from the main balance.
         */
        const balanceAdjustment = parked - actualSpent;
        
        workspace.walletBalance = (workspace.walletBalance || 0) + balanceAdjustment;
        workspace.walletParkedBalance = Math.max(0, parked - parked); // Clear the parked amount for this campaign

        // Sync nested wallet
        if (workspace.wallet) {
          workspace.wallet.balance = workspace.walletBalance;
          workspace.wallet.parkedBalance = workspace.walletParkedBalance;
        }

        await workspace.save({ session });

        // 3. Record the transaction
        const isRefund = balanceAdjustment > 0;
        await WalletTransaction.create([{
          workspace: workspaceId,
          type: isRefund ? 'UNPARK' : 'SPEND',
          amount: Math.abs(balanceAdjustment),
          previousBalance: workspace.walletBalance - balanceAdjustment,
          newBalance: workspace.walletBalance,
          referenceType: 'CAMPAIGN',
          referenceId: new Types.ObjectId(campaignId),
          status: 'COMPLETED',
          description: isRefund 
            ? `Campaign settled: ${actualSpent} spent, ${balanceAdjustment} refunded to balance`
            : `Campaign settled: ${actualSpent} spent, ${Math.abs(balanceAdjustment)} overage deducted from balance`
        }], { session });

        // Emit Real-time Update
        const { broadcastToWorkspace } = require('../socket-emitter');
        broadcastToWorkspace(workspaceId.toString(), "workspace:wallet_update", { balance: workspace.walletBalance, parkedBalance: workspace.walletParkedBalance });

        console.log(`[Ledger:ResolveCampaign] Campaign ${campaignId} settled. Adjustment: ${balanceAdjustment}`);
        return true;
      });
    } catch (err: any) {
      console.error(`[Ledger:ResolveCampaign Error]:`, err.message || err);
      throw err;
    } finally {
      session.endSession();
    }
  }
}
