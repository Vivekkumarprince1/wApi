import { NextRequest, NextResponse } from "next/server";
import { isSuperAdmin } from "@/lib/middlewares/auth";
import { BillingProxy } from "@/lib/services/billing/billing-proxy";

export const GET = isSuperAdmin(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const limit = searchParams.get('limit') || '50';
    
    const response = await BillingProxy.forward('GET', '/api/billing/wallets/admin/all-invoices', {
        params: { limit }
    });

    if (response.status !== 200) {
      return NextResponse.json({ message: "Failed to fetch invoices" }, { status: response.status });
    }

    return NextResponse.json(response.data.invoices || []);
  } catch (err: any) {
    console.error("[Invoices Admin API Error]:", err.message);
    return NextResponse.json({ message: "Server Error", error: err.message }, { status: 500 });
  }
}) as any;
