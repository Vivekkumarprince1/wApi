import { WalletModel, WalletTransactionModel } from '../models';
import mongoose from 'mongoose';

export class LedgerService {
  async getWallet(workspaceId: string) {
    let wallet = await WalletModel.findOne({ workspaceId });
    if (!wallet) {
      wallet = await WalletModel.create({ workspaceId, availableBalance: 0, parkedBalance: 0 });
    }
    return wallet;
  }

  async credit(
    workspaceId: string, 
    amount: number, 
    description: string, 
    externalReferenceId?: string
  ) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      if (externalReferenceId) {
        const existingTx = await WalletTransactionModel.findOne({ externalReferenceId }).session(session);
        if (existingTx) {
          const wallet = await WalletModel.findOne({ workspaceId }).session(session);
          await session.commitTransaction();
          session.endSession();
          return wallet!;
        }
      }

      let wallet = await WalletModel.findOne({ workspaceId }).session(session);
      if (!wallet) {
        wallet = new WalletModel({ workspaceId, availableBalance: 0, parkedBalance: 0 });
      }

      const previousBalance = wallet.availableBalance + wallet.parkedBalance;
      
      wallet.availableBalance += amount;
      await wallet.save({ session });

      const tx = new WalletTransactionModel({
        workspaceId,
        amount,
        type: 'RECHARGE',
        previousBalance,
        newBalance: wallet.availableBalance + wallet.parkedBalance,
        description,
        externalReferenceId,
        status: 'COMPLETED'
      });
      await tx.save({ session });

      await session.commitTransaction();
      session.endSession();
      return wallet;
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  }

  /**
   * Deduct funds. Pass `idempotencyKey` (or `externalReferenceId`) for any
   * caller that may retry — duplicate calls with the same key return the
   * existing wallet without double-spending.
   */
  async deduct(
    workspaceId: string,
    amount: number,
    description: string,
    referenceType?: string,
    referenceId?: string,
    idempotencyKey?: string
  ) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      // Idempotency check — if a transaction with the same key already
      // exists, return the current wallet without reapplying the spend.
      if (idempotencyKey) {
        const existingTx = await WalletTransactionModel.findOne({
          externalReferenceId: idempotencyKey,
        }).session(session);
        if (existingTx) {
          const wallet = await WalletModel.findOne({ workspaceId }).session(session);
          await session.commitTransaction();
          session.endSession();
          return wallet!;
        }
      }

      const wallet = await WalletModel.findOne({ workspaceId }).session(session);
      if (!wallet) throw new Error('WORKSPACE_NOT_FOUND');
      if (wallet.availableBalance < amount) throw new Error('INSUFFICIENT_FUNDS');

      const previousBalance = wallet.availableBalance + wallet.parkedBalance;

      wallet.availableBalance -= amount;
      await wallet.save({ session });

      const tx = new WalletTransactionModel({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        amount,
        type: 'SPEND',
        previousBalance,
        newBalance: wallet.availableBalance + wallet.parkedBalance,
        description,
        referenceType,
        referenceId,
        externalReferenceId: idempotencyKey,
        status: 'COMPLETED'
      });
      await tx.save({ session });

      await session.commitTransaction();
      session.endSession();
      return wallet;
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  }

  /**
   * Reserve (park) campaign budget. Idempotent per campaignId — re-calling
   * for the same campaign is a no-op once a PARK transaction exists.
   */
  async reserveCampaignBudget(workspaceId: string, amount: number, campaignId: string) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const idempotencyKey = `park:${campaignId}`;
      const existingTx = await WalletTransactionModel.findOne({
        externalReferenceId: idempotencyKey,
      }).session(session);
      if (existingTx) {
        await session.commitTransaction();
        session.endSession();
        return;
      }

      const wallet = await WalletModel.findOne({ workspaceId }).session(session);
      if (!wallet) throw new Error('WORKSPACE_NOT_FOUND');
      if (wallet.availableBalance < amount) throw new Error('INSUFFICIENT_FUNDS');

      const previousBalance = wallet.availableBalance + wallet.parkedBalance;

      wallet.availableBalance -= amount;
      wallet.parkedBalance += amount;
      await wallet.save({ session });

      const tx = new WalletTransactionModel({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        amount,
        type: 'PARK',
        previousBalance,
        newBalance: wallet.availableBalance + wallet.parkedBalance,
        description: `Budget reserved for campaign ${campaignId}`,
        referenceType: 'CAMPAIGN',
        referenceId: campaignId,
        externalReferenceId: idempotencyKey,
        status: 'COMPLETED'
      });
      await tx.save({ session });

      await session.commitTransaction();
      session.endSession();
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  }

  /**
   * Settle a previously-parked campaign budget. Idempotent per campaignId.
   */
  async settleCampaignBudget(
    workspaceId: string,
    campaignId: string,
    reservedAmount: number,
    actualSpend: number
  ) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const idempotencyKey = `settle:${campaignId}`;
      const existingTx = await WalletTransactionModel.findOne({
        externalReferenceId: idempotencyKey,
      }).session(session);
      if (existingTx) {
        await session.commitTransaction();
        session.endSession();
        return;
      }

      const wallet = await WalletModel.findOne({ workspaceId }).session(session);
      if (!wallet) throw new Error('WORKSPACE_NOT_FOUND');
      if (wallet.parkedBalance < reservedAmount) throw new Error('INVALID_RESERVED_AMOUNT');

      const previousBalance = wallet.availableBalance + wallet.parkedBalance;
      const refundAmount = reservedAmount - actualSpend;

      wallet.parkedBalance -= reservedAmount;
      wallet.availableBalance += refundAmount;

      await wallet.save({ session });

      const isRefund = refundAmount > 0;
      const tx = new WalletTransactionModel({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        amount: actualSpend,
        type: isRefund ? 'UNPARK' : 'SPEND',
        previousBalance,
        newBalance: wallet.availableBalance + wallet.parkedBalance,
        description: `Campaign ${campaignId} settled. Spent: ${actualSpend}. Refunded: ${Math.max(0, refundAmount)}`,
        referenceType: 'CAMPAIGN',
        referenceId: campaignId,
        externalReferenceId: idempotencyKey,
        status: 'COMPLETED'
      });
      await tx.save({ session });

      await session.commitTransaction();
      session.endSession();
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  }

  /**
   * Migrate a balance from the legacy (monolith) wallet store. Captures
   * `previousBalance` BEFORE the mutation so the audit trail does not
   * mis-report an already-mutated value. Idempotent via `isLegacySynced`.
   */
  async syncLegacyBalance(workspaceId: string, balancePaise: number) {
    let wallet = await WalletModel.findOne({ workspaceId });

    let previousBalance = 0;
    let isNew = false;

    if (!wallet) {
      isNew = true;
      wallet = new WalletModel({
        workspaceId,
        availableBalance: balancePaise,
        parkedBalance: 0,
        isLegacySynced: true,
      });
    } else {
      if (wallet.isLegacySynced) return wallet;

      // Capture state BEFORE mutation; the previous logic computed it
      // post-hoc by subtracting and could drift if other fields changed.
      previousBalance = wallet.availableBalance + wallet.parkedBalance;
      wallet.availableBalance += balancePaise;
      wallet.isLegacySynced = true;
    }

    await wallet.save();

    const tx = new WalletTransactionModel({
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      amount: balancePaise,
      type: 'MIGRATION',
      previousBalance: isNew ? 0 : previousBalance,
      newBalance: wallet.availableBalance + wallet.parkedBalance,
      description: 'Legacy Balance Sync (Automated Merge)',
      externalReferenceId: `legacy-sync:${workspaceId}`,
      status: 'COMPLETED'
    });
    await tx.save();

    return wallet;
  }
}
