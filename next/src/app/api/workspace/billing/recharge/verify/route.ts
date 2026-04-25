/**
 * RECHARGE VERIFICATION API
 * 
 * Verifies Razorpay payment signature and credits the workspace wallet.
 */

import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/middlewares/auth';
import { RazorpayService } from '@/lib/services/billing/razorpay-service';
import { LedgerService } from '@/lib/services/billing/ledger-service';

export const POST = withAuth(async (req: any, { workspace }: any) => {
  try {
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature 
    } = await req.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ message: 'Missing payment details' }, { status: 400 });
    }

    // 1. Verify Signature
    const isValid = RazorpayService.verifySignature(
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature
    );

    if (!isValid) {
      return NextResponse.json({ message: 'Invalid payment signature' }, { status: 400 });
    }

    // 2. Fetch Payment Details from Razorpay (Secure amount check)
    const payment = await RazorpayService.getPaymentDetails(razorpay_payment_id);
    
    if (payment.status !== 'captured' && payment.status !== 'authorized') {
      return NextResponse.json({ message: `Payment in ${payment.status} state` }, { status: 400 });
    }

    // 3. Credit the Wallet using LedgerService (Atomic transaction with Idempotency)
    const amountPaise = typeof payment.amount === 'string' ? parseInt(payment.amount) : payment.amount;
    
    const result = await LedgerService.credit(workspace._id, amountPaise, {
      type: 'RECHARGE',
      referenceType: 'PAYMENT',
      externalReferenceId: razorpay_payment_id,
      description: `Razorpay Recharge: ${razorpay_payment_id}`
    });

    // 4. Generate Automated Invoice
    try {
      const { BillingInvoiceService } = await import('@/lib/services/billing/billing-invoice-service');
      const { WalletTransaction } = await import('@/lib/models');
      const transaction = await WalletTransaction.findOne({ externalReferenceId: razorpay_payment_id });
      if (transaction) {
        await BillingInvoiceService.generateForTransaction(transaction._id);
      }
    } catch (invoiceErr: any) {
      console.error('[Recharge:InvoiceError]:', invoiceErr.message);
      // We don't fail the payment if invoice generation fails, but we log it.
    }

    return NextResponse.json({
      success: true,
      message: 'Wallet credited successfully',
      newBalance: result.newBalance
    });

  } catch (error: any) {
    console.error('[Recharge Verification Error]:', error.message);
    return NextResponse.json({ message: 'Verification failed', error: error.message }, { status: 500 });
  }
});
