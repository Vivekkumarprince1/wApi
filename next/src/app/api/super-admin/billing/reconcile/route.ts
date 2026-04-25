import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db-connect';
import { withRole } from '@/lib/middlewares/auth';
import { WalletTransaction, Workspace } from '@/lib/models';

export const POST = withRole(['super_admin'], async (_req: NextRequest) => {
  try {
    await dbConnect();

    const [walletTotals, workspaceCount] = await Promise.all([
      WalletTransaction.aggregate([
        { $match: { type: 'RECHARGE', status: 'COMPLETED' } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Workspace.countDocuments({}),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        activeRevenue: walletTotals[0]?.total || 0,
        rechargeTransactions: walletTotals[0]?.count || 0,
        workspaceCount,
      },
      message: 'Billing reconciliation snapshot generated',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'Failed to reconcile billing', error: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}) as any;
