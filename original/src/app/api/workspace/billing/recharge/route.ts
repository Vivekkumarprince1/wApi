/**
 * RECHARGE INITIATION API
 * 
 * Proxies to billing-service to create a Razorpay order.
 */

import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/middlewares/auth';
import { BillingProxy } from '@/lib/services/billing/billing-proxy';

export const POST = withAuth(async (req: any, { workspace, user }: any) => {
  try {
    const { amountPaise } = await req.json();

    if (!amountPaise || amountPaise < 10000) { // Min 100 INR
      return NextResponse.json({ message: 'Minimum recharge amount is 100 INR' }, { status: 400 });
    }

    const response = await BillingProxy.forward('POST', `/api/billing/wallets/${workspace._id}/recharge`, {
      data: { amountPaise },
      workspaceId: workspace._id.toString(),
      userId: user._id.toString()
    });

    return NextResponse.json({
      success: response.status === 200,
      ...response.data,
      keyId: process.env.RAZORPAY_KEY_ID
    }, { status: response.status });

  } catch (error: any) {
    console.error('[Recharge API Error]:', error.message);
    return NextResponse.json({ message: 'Failed to initiate recharge', error: error.message }, { status: 500 });
  }
});
