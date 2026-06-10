import { NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@/server/auth";
import { getConnection } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Dashboard summary — direct MongoDB read (Rule #4).
 *
 * Mirrors core-server adminController.getStats: workspace/user counts, messages
 * in the last 30 days, active subscriptions, active BSP connections, and gross
 * wallet-funded revenue. All cheap aggregate/count reads against the core DB
 * (billing collections live in the same `test` database here).
 */
export async function GET() {
  try {
    await requireAdmin("read");

    const conn = await getConnection("core");
    const db = conn.db;
    if (!db) throw new Error("Database handle unavailable");

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      workspaces,
      users,
      activeWorkspaces,
      totalMessages30d,
      activeSubscriptions,
      activeBSPs,
      revenueAgg,
    ] = await Promise.all([
      db.collection("workspaces").estimatedDocumentCount(),
      db.collection("users").estimatedDocumentCount(),
      db.collection("workspaces").countDocuments({ billingStatus: { $in: ["active", "trialing"] } }),
      db
        .collection("messages")
        .countDocuments({ createdAt: { $gte: thirtyDaysAgo }, isInternalNote: { $ne: true } }),
      db.collection("subscriptions").countDocuments({ status: "active" }),
      db.collection("businessappmaps").countDocuments({ active: true }),
      // Gross revenue = sum of completed RECHARGE wallet transactions (paise).
      db
        .collection("wallettransactions")
        .aggregate([
          { $match: { type: "RECHARGE", status: "COMPLETED" } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ])
        .toArray(),
    ]);

    const grossRevenuePaise = revenueAgg[0]?.total || 0;

    return NextResponse.json({
      stats: {
        totalWorkspaces: workspaces,
        totalUsers: users,
        activeWorkspaces,
        totalMessages30d,
        activeSubscriptions,
        activeBSPs,
        grossRevenuePaise,
        currency: "INR",
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    console.error("[admin/read/dashboard]", err);
    return NextResponse.json({ message: "Failed to load dashboard" }, { status: 500 });
  }
}
