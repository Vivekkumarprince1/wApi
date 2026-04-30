/**
 * RAZORPAY WEBHOOK HANDLER (PROXY)
 * 
 * Proxies the webhook payload to billing-service for processing.
 */

import { NextRequest, NextResponse } from "next/server";
import { BillingProxy } from "@/lib/services/billing/billing-proxy";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const signature = req.headers.get("x-razorpay-signature");

    if (!signature) {
      return NextResponse.json({ message: "No signature provided" }, { status: 400 });
    }

    // Forward to billing-service using standardized Proxy
    const response = await BillingProxy.forward('POST', '/api/billing/webhooks/razorpay', {
      data: body,
      params: { signature } // Passing signature as param to allow the proxy to handle it if needed
    });

    return NextResponse.json(response.data, { status: response.status });
  } catch (err: any) {
    console.error("[Razorpay Webhook Proxy Error]:", err.message);
    return NextResponse.json({ message: "Internal Error", error: err.message }, { status: 500 });
  }
}
