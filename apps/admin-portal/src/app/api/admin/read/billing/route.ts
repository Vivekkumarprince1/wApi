import { NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@/server/auth";
import { billingModels, coreModels } from "@/server/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Billing overview — direct read from wapi_billing (Rule #4).
 * Returns subscription counts by status, wallet totals, recent transactions,
 * and the plan catalogue (from the core DB).
 */
export async function GET() {
  try {
    await requireAdmin("billing");

    const { Subscription, Wallet, WalletTransaction } = await billingModels();
    const { Plan } = await coreModels();

    const [subsByStatus, walletAgg, recentTx, plans] = await Promise.all([
      Subscription.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Wallet.aggregate([
        {
          $group: {
            _id: null,
            available: { $sum: "$availableBalance" },
            parked: { $sum: "$parkedBalance" },
            wallets: { $sum: 1 },
          },
        },
      ]),
      WalletTransaction.find({})
        .select("workspaceId amount type description status createdAt")
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
      Plan.find({}).select("name slug isActive pricing limits").sort({ name: 1 }).lean(),
    ]);

    const subscriptions: Record<string, number> = {};
    for (const row of subsByStatus) subscriptions[row._id || "unknown"] = row.count;

    const wallet = walletAgg[0] || { available: 0, parked: 0, wallets: 0 };

    return NextResponse.json({
      subscriptions,
      wallet: {
        available: wallet.available || 0,
        parked: wallet.parked || 0,
        wallets: wallet.wallets || 0,
      },
      recentTransactions: recentTx,
      plans,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    console.error("[admin/read/billing]", err);
    return NextResponse.json({ message: "Failed to load billing data" }, { status: 500 });
  }
}
