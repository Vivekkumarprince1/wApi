import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middlewares/auth";
import { BillingProxy } from "@/lib/services/billing/billing-proxy";

export const GET = withAuth(async (req: NextRequest, { workspace, user }, params: any) => {
  try {
    const invoiceId = params?.params?.id || req.nextUrl.pathname.split('/').slice(-2, -1)[0];

    // Proxy to Billing Service using standardized Proxy
    const response = await BillingProxy.forward('GET', `/api/billing/wallets/invoices/${invoiceId}/download`, {
      params: {
        workspaceId: workspace._id.toString(),
        workspaceName: workspace.name,
        ownerName: (workspace.owner as any)?.name || 'Admin',
        ownerEmail: (workspace.owner as any)?.email || '',
        country: workspace.country || ''
      },
      workspaceId: workspace._id.toString(),
      userId: user._id.toString()
    });

    if (response.status !== 200) {
      return new NextResponse("Invoice not found or failed to generate", { status: response.status });
    }

    return new NextResponse(response.data, {
      status: 200,
      headers: {
        'Content-Type': 'text/html'
      }
    });

  } catch (err: any) {
    console.error("[Invoice Download Error]:", err.message);
    return new NextResponse("Failed to download invoice", { status: 500 });
  }
});

