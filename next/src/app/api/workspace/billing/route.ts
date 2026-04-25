import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middlewares/auth';
import { WalletTransaction, Workspace } from '@/lib/models';

export const GET = withAuth(async (req: any, { workspace }: any) => {
  // Re-fetch workspace to ensure we have the most up-to-date database data
  // and handle the legacy nested wallet structure.
  const fullWorkspace: any = await Workspace.findById(workspace._id).populate('plan').lean();

  if (!fullWorkspace) {
    return NextResponse.json({ message: "Workspace not found" }, { status: 404 });
  }

  // Fetch recent transactions
  const transactions = await WalletTransaction.find({ workspace: workspace._id })
    .sort({ createdAt: -1 })
    .limit(20);

  // Fetch associated invoices to show invoice numbers in the table
  const transactionIds = transactions.map(t => t._id.toString());
  const invoices = await (require('@/lib/models')).Invoice.find({ 
    providerInvoiceId: { $in: transactionIds } 
  }).select('providerInvoiceId invoiceNumber').lean();

  const invoiceMap = new Map(invoices.map((inv: any) => [inv.providerInvoiceId, inv.invoiceNumber]));

  return NextResponse.json({
    wallet: {
      balance: (fullWorkspace.wallet?.balance ?? fullWorkspace.walletBalance ?? 0) / 100,
      currency: fullWorkspace.wallet?.currency ?? fullWorkspace.walletCurrency ?? 'INR',
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
    transactions: transactions.map(tx => {
      const obj = tx instanceof (require('mongoose')).Document ? tx.toObject() : tx;
      return { 
        ...obj, 
        amount: (obj.amount || 0) / 100,
        invoiceNumber: invoiceMap.get(obj._id.toString()) || null
      };
    })
  });
});
