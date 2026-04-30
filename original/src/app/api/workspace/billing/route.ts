import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/middlewares/auth';
import { BillingProxy } from '@/lib/services/billing/billing-proxy';

export const GET = withAuth(async (req: any, { workspace, user }: any) => {
  try {
    // 1. Fetch data from Billing Microservice using Proxy
    const [txResponse, walletResponse] = await Promise.all([
      BillingProxy.forward('GET', `/api/billing/wallets/${workspace._id}/transactions`, { 
        params: { limit: 20 },
        workspaceId: workspace._id.toString(),
        userId: user._id.toString()
      }),
      BillingProxy.forward('GET', `/api/billing/wallets/${workspace._id}`, {
        workspaceId: workspace._id.toString(),
        userId: user._id.toString()
      })
    ]);

    const transactions = txResponse.data.transactions || [];
    let walletData = walletResponse.data.wallet || {};

    // 2. Fetch local Workspace for plan details (Monolith-specific data)
    const { Workspace } = await import('@/lib/models');
    const fullWorkspace: any = await Workspace.findById(workspace._id).populate('plan').lean();

    // 3. Automated Data Sync (One-time migration check)
    // If billing-service has not synced legacy balance yet, trigger it now.
    const localBalancePaise = fullWorkspace?.wallet?.balance ?? fullWorkspace?.walletBalance ?? 0;
    if (!walletData.isLegacySynced && localBalancePaise > 0) {
        console.log(`[BillingSync] Merging legacy balance for ${workspace.name}: ${localBalancePaise} paise`);
        try {
            const syncResponse = await BillingProxy.forward('POST', `/api/billing/wallets/${workspace._id}/sync`, {
                data: { balancePaise: localBalancePaise },
                workspaceId: workspace._id.toString(),
                userId: user._id.toString()
            });
            if (syncResponse.status === 200) {
                walletData = syncResponse.data.wallet;
            }
        } catch (syncErr: any) {
            console.error(`[BillingSync] Failed to sync balance for ${workspace._id}:`, syncErr.message);
        }
    }

    return NextResponse.json({
      wallet: {
        balance: (walletData.availableBalance ?? 0) / 100,
        currency: walletData.currency ?? 'INR',
        status: fullWorkspace.billingStatus || 'active',
      },
      subscription: {
          billingPivotDate: fullWorkspace.billingPivotDate,
          autoPay: fullWorkspace.autoPay ?? true,
          taxId: fullWorkspace.taxId || '',
          billingIntervalMonths: (fullWorkspace.plan as any)?.billingIntervalMonths || 1,
      },
      plan: {
        name: (fullWorkspace.plan as any)?.name || fullWorkspace.planId || 'Free',
        slug: (fullWorkspace.plan as any)?.slug || 'free',
        limits: (fullWorkspace.plan as any)?.limits || fullWorkspace.planLimits || {},
        usage: fullWorkspace.usage || {},
      },
      transactions: transactions.map((tx: any) => ({
        ...tx,
        _id: tx._id || tx.id,
        amount: (tx.amount || 0) / 100,
        invoiceNumber: tx.invoiceNumber || null
      }))
    });
  } catch (error: any) {
    console.error("[Billing Route Error]:", error.message);
    return NextResponse.json({ message: "Failed to fetch billing data" }, { status: 500 });
  }
});
