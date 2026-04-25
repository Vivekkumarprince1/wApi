/**
 * RAZORPAY WEBHOOK HANDLER
 * 
 * Secure server-to-server notification handler for Razorpay events.
 * Ensures wallet credits are processed reliably even if client-side verification fails.
 */

import { NextRequest, NextResponse } from "next/server";
import { RazorpayService } from "@/lib/services/billing/razorpay-service";
import { LedgerService } from "@/lib/services/billing/ledger-service";
import { BillingInvoiceService } from "@/lib/services/billing/billing-invoice-service";
import { WalletTransaction, Workspace } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "razorpay_secret_123"; // User should set this in .env

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get("x-razorpay-signature");

    if (!signature) {
      return NextResponse.json({ message: "No signature provided" }, { status: 400 });
    }

    // 1. Verify Signature
    const isValid = RazorpayService.validateWebhookSignature(body, signature, WEBHOOK_SECRET);
    if (!isValid) {
      console.error("[Razorpay Webhook] Invalid signature detected.");
      return NextResponse.json({ message: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(body);
    console.log(`[Razorpay Webhook] Received event: ${event.event}`);

    await dbConnect();

    // 2. Handle relevant events
    if (event.event === 'payment.captured' || event.event === 'order.paid') {
      const payment = event.payload.payment.entity;
      const orderId = payment.order_id;
      const paymentId = payment.id;
      const amount = payment.amount; // In paise
      const workspaceId = payment.notes?.workspaceId;

      if (!workspaceId) {
        console.warn("[Razorpay Webhook] No workspaceId found in payment notes.");
        return NextResponse.json({ message: "Ignored: No workspace metadata" });
      }

      console.log(`[Razorpay Webhook] Processing credit for workspace ${workspaceId}, payment ${paymentId}`);

      // 3. Credit Wallet (Ledger handles idempotency via externalReferenceId)
      const result = await LedgerService.credit(workspaceId, amount, {
        type: 'RECHARGE',
        referenceType: 'PAYMENT',
        externalReferenceId: paymentId,
        description: `Wallet Recharge (via Webhook) - Ref: ${paymentId}`
      });

      // 4. Trigger Invoice Generation
      if (result.success) {
        // Find the transaction record created by Ledger
        const transaction = await WalletTransaction.findOne({ 
            externalReferenceId: paymentId,
            workspace: workspaceId 
        });

        if (transaction) {
          await BillingInvoiceService.generateForTransaction(transaction._id);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[Razorpay Webhook Error]:", err.message);
    return NextResponse.json({ message: "Internal Error", error: err.message }, { status: 500 });
  }
}
