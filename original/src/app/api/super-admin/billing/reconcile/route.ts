import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db-connect';
import { withRole } from '@/lib/middlewares/auth';
import { Workspace } from '@/lib/models';
import { LedgerService } from '@/lib/services/billing/ledger-service';

export const POST = withRole(['super_admin'], async (_req: NextRequest) => {
  try {
    await dbConnect();

    const [billingStats, workspaceCount] = await Promise.all([
      LedgerService.getGlobalStats(),
      Workspace.countDocuments({}),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        activeRevenue: billingStats.grossRevenue,
        rechargeTransactions: 0, // Microservice doesn't provide this count yet
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
