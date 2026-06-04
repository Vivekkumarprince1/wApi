import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { requireAdmin, AdminAuthError } from "@/server/auth";
import { coreModels, billingModels } from "@/server/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Workspace detail — direct read (Rule #4). Mirrors core-server
 * adminController.getWorkspace, enriched with the workspace's members, wallet,
 * subscription and recent invoices (all live in the same `test` database here).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin("workspaces");
    const { id } = await params;

    const { Workspace, User } = await coreModels();
    const { Wallet, Subscription, Invoice } = await billingModels();

    const workspace = await Workspace.findById(id)
      .populate("owner", "name email")
      .populate("plan", "name slug features maxActivePhones monthlyBaseFeeCents isActive")
      .lean();

    if (!workspace) {
      return NextResponse.json({ message: "Workspace not found" }, { status: 404 });
    }

    let wsObjectId: Types.ObjectId | string = id;
    try {
      wsObjectId = new Types.ObjectId(id);
    } catch {
      /* leave as string */
    }
    const wsRefMatch = { $in: [wsObjectId, id] };

    const [members, wallet, subscription, invoices] = await Promise.all([
      User.find({ workspace: wsRefMatch })
        .select("name email role status lastLoginAt createdAt")
        .sort({ createdAt: 1 })
        .lean(),
      Wallet.findOne({ $or: [{ workspaceId: wsRefMatch }, { workspace: wsRefMatch }] }).lean(),
      Subscription.findOne({ $or: [{ workspaceId: wsRefMatch }, { workspace: wsRefMatch }] })
        .sort({ createdAt: -1 })
        .lean(),
      Invoice.find({ $or: [{ workspaceId: wsRefMatch }, { workspace: wsRefMatch }] })
        .select("invoiceNumber status totalCents currency billingPeriod issuedAt paidAt")
        .sort({ issuedAt: -1 })
        .limit(10)
        .lean(),
    ]);

    return NextResponse.json({
      workspace,
      members,
      wallet,
      subscription,
      invoices,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    console.error("[admin/read/workspaces/:id]", err);
    return NextResponse.json({ message: "Failed to load workspace" }, { status: 500 });
  }
}
