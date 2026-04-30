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

  async deduct(
    workspaceId: string,
    amount: number,
    description: string,
    referenceType?: string,
    referenceId?: string
  ) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const wallet = await WalletModel.findOne({ workspaceId }).session(session);
      if (!wallet) throw new Error('WORKSPACE_NOT_FOUND');
      if (wallet.availableBalance < amount) throw new Error('INSUFFICIENT_FUNDS');

      const previousBalance = wallet.availableBalance + wallet.parkedBalance;

      wallet.availableBalance -= amount;
      await wallet.save({ session });

      const tx = new WalletTransactionModel({
        workspaceId,
        amount,
        type: 'SPEND',
        previousBalance,
        newBalance: wallet.availableBalance + wallet.parkedBalance,
        description,
        referenceType,
        referenceId,
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

  async reserveCampaignBudget(workspaceId: string, amount: number, campaignId: string) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const wallet = await WalletModel.findOne({ workspaceId }).session(session);
      if (!wallet) throw new Error('WORKSPACE_NOT_FOUND');
      if (wallet.availableBalance < amount) throw new Error('INSUFFICIENT_FUNDS');

      const previousBalance = wallet.availableBalance + wallet.parkedBalance;
      
      wallet.availableBalance -= amount;
      wallet.parkedBalance += amount;
      await wallet.save({ session });

      const tx = new WalletTransactionModel({
        workspaceId,
        amount,
        type: 'PARK',
        previousBalance,
        newBalance: wallet.availableBalance + wallet.parkedBalance,
        description: `Budget reserved for campaign ${campaignId}`,
        referenceType: 'CAMPAIGN',
        referenceId: campaignId,
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

  async settleCampaignBudget(
    workspaceId: string, 
    campaignId: string, 
    reservedAmount: number, 
    actualSpend: number
  ) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
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

  async syncLegacyBalance(workspaceId: string, balancePaise: number) {
    let wallet = await WalletModel.findOne({ workspaceId });
    
    if (!wallet) {
        wallet = new WalletModel({ 
          workspaceId, 
          availableBalance: balancePaise, 
          parkedBalance: 0,
          isLegacySynced: true
        });
    } else {
        if (wallet.isLegacySynced) return wallet; // Already merged

        wallet.availableBalance += balancePaise;
        wallet.isLegacySynced = true;
    }

    await wallet.save();

    const tx = new WalletTransactionModel({
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      amount: balancePaise,
      type: 'MIGRATION',
      previousBalance: wallet.availableBalance - balancePaise,
      newBalance: wallet.availableBalance,
      description: 'Legacy Balance Sync (Automated Merge)',
      status: 'COMPLETED'
    });
    await tx.save();

    return wallet;
  }
}
