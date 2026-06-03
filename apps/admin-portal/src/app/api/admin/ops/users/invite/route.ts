import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@/server/auth";
import { recordAudit, clientIp } from "@/server/audit";
import { inviteUser } from "@/server/config-ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Invite a user — SELF-CONTAINED direct write (creates an invited User). */
export async function POST(req: NextRequest) {
  try {
    const actor = await requireAdmin("workspaces");
    const body = await req.json().catch(() => ({}));

    const data = await inviteUser({ email: body.email, name: body.name, role: body.role });

    await recordAudit({
      actor,
      action: "user.invite",
      target: "user",
      targetId: data.id,
      metadata: { email: body?.email, mode: "direct" },
      ip: clientIp(req),
      outcome: "success",
    });

    // Don't leak the invitation token in the response body.
    return NextResponse.json({ ok: true, data: { id: data.id } });
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Invite failed";
    console.error("[admin/ops/users/invite]", err);
    return NextResponse.json({ message }, { status: 400 });
  }
}
