import { NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@/server/auth";
import { billingModels, coreModels } from "@/server/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Billing snapshot stats — direct read (Rule #4). Mirrors the billing-service
 * getBillingStats / core-server billingStats the reference super-admin billing
 * page consumes:
 *   - grossRevenue   : sum of COMPLETED RECHARGE + PLAN_PURCHASE transactions
 *   - activeSubs      : active subscriptions
 *   - pendingPayouts  : settlements awaiting payout (0 — no payout ledger here)
 *   - churnRate       : platform churn estimate
 * Amounts are returned in BOTH paise (raw) and rupees so the client can render
 * without guessing the unit.
 */
export async function GET() {
  try {
    await requireAdmin("billing");

    const { Subscription, WalletTransaction } = await billingModels();
    const { Plan, Workspace } = await coreModels();

    const [revenueAgg, activeSubs, planCount, totalWorkspaces, subsByStatus] = await Promise.all([
      WalletTransaction.aggregate([
        { $match: { type: { $in: ["RECHARGE", "PLAN_PURCHASE"] }, status: "COMPLETED" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Subscription.countDocuments({ status: "active" }),
      Plan.countDocuments({}),
      Workspace.estimatedDocumentCount(),
      Subscription.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    ]);

    const grossRevenuePaise = revenueAgg[0]?.total || 0;

    const subCounts: Record<string, number> = {};
    for (const row of subsByStatus) subCounts[row._id || "unknown"] = row.count;
    const totalSubs = Object.values(subCounts).reduce((a, b) => a + b, 0);
    const churned = (subCounts.canceled || 0) + (subCounts.suspended || 0);
    const churnRate = totalSubs > 0 ? +((churned / totalSubs) * 100).toFixed(1) : 0;

    return NextResponse.json({
      grossRevenuePaise,
      grossRevenue: Math.round(grossRevenuePaise / 100),
      activeSubs,
      planCount,
      pendingPayouts: 0,
      churnRate,
      totalWorkspaces,
      currency: "INR",
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    console.error("[admin/read/billing-stats]", err);
    return NextResponse.json({ message: "Failed to load billing stats" }, { status: 500 });
  }
}
