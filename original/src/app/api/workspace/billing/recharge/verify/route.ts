import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/middlewares/auth';
import { BillingProxy } from '@/lib/services/billing/billing-proxy';

export const POST = withAuth(async (req: any, { workspace, user }: any) => {
  try {
    const body = await req.json();
    
    // Proxy request to Billing Service
    const response = await BillingProxy.forward('POST', '/api/billing/wallets/recharge/verify', {
      data: {
        ...body,
        workspaceId: workspace._id,
        workspaceDetails: {
            name: workspace.name,
            country: workspace.country,
            walletCurrency: workspace.walletCurrency || 'INR'
        }
      },
      workspaceId: workspace._id.toString(),
      userId: user._id.toString()
    });

    if (response.status !== 200) {
      return NextResponse.json({ 
          message: 'Verification failed', 
          error: response.data?.error || 'Unknown error' 
      }, { status: response.status });
    }

    return NextResponse.json({
      success: true,
      message: 'Wallet credited successfully',
      wallet: response.data.wallet
    });

  } catch (error: any) {
    console.error('[Recharge Verification Error]:', error.message);
    return NextResponse.json({ 
        message: 'Verification failed', 
        error: error.message 
    }, { status: 500 });
  }
});
