import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@/server/auth";
import { coreModels } from "@/server/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

/**
 * User directory — direct MongoDB read (Rule #4).
 * ?q= matches name/email, ?role= filter, ?page= pagination.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin("workspaces");

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const role = (searchParams.get("role") || "").trim();
    const page = Math.max(1, Number(searchParams.get("page") || 1));

    const filter: Record<string, unknown> = {};
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
      ];
    }
    if (role) filter.role = role;

    const { User } = await coreModels();

    const [items, total] = await Promise.all([
      User.find(filter)
        .select("name email role status activeWorkspace lastLoginAt createdAt")
        .sort({ createdAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .lean(),
      User.countDocuments(filter),
    ]);

    return NextResponse.json({
      items,
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    });
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    console.error("[admin/read/users]", err);
    return NextResponse.json({ message: "Failed to load users" }, { status: 500 });
  }
}
