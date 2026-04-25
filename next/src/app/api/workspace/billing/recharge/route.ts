/**
 * RECHARGE INITIATION API
 * 
 * Creates a Razorpay order for the workspace wallet recharge.
 */

import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/middlewares/auth';
import { RazorpayService } from '@/lib/services/billing/razorpay-service';

export const POST = withAuth(async (req: any, { workspace }: any) => {
  try {
    const { amountPaise } = await req.json();

    if (!amountPaise || amountPaise < 10000) { // Min 100 INR
      return NextResponse.json({ message: 'Minimum recharge amount is 100 INR' }, { status: 400 });
    }

    const order = await RazorpayService.createRechargeOrder(amountPaise, workspace._id.toString());

    return NextResponse.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID
    });

  } catch (error: any) {
    console.error('[Recharge API Error]:', error.message);
    return NextResponse.json({ message: 'Failed to initiate recharge', error: error.message }, { status: 500 });
  }
});
