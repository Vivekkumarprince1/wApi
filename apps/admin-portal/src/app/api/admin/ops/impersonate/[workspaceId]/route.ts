import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@/server/auth";
import { recordAudit, clientIp } from "@/server/audit";
import { coreModels } from "@/server/models";
import { impersonateWorkspace } from "@/server/workspace-ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Impersonation — SELF-CONTAINED. The portal mints the impersonation
 * `auth_token` directly (signImpersonationToken, identical to core-server's
 * signToken), records it in `impersonation_logs` + audit, then hands it to the
 * admin as a cookie scoped to the shared parent domain so the customer portal
 * accepts the impersonated session, plus a target URL.
 *
 * Local dev note: cross-port localhost cannot share a cookie, so the returned
 * `token` lets the client/dev open the customer portal manually.
 */

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;

  try {
    const actor = await requireAdmin("workspaces");
    const ip = clientIp(req);

    let token: string | undefined;
    let targetUserId: string | undefined;
    let targetEmail: string | undefined;
    let ok = true;
    let errorMsg: string | undefined;

    try {
      const result = await impersonateWorkspace(workspaceId, actor.userId);
      token = result.token;
      targetUserId = result.targetUserId;
      targetEmail = result.targetEmail;
    } catch (e) {
      ok = false;
      errorMsg = e instanceof Error ? e.message : "Impersonation failed";
    }

    // Persist a dedicated impersonation log entry.
    try {
      const { ImpersonationLog } = await coreModels();
      await ImpersonationLog.create({
        adminId: actor.userId,
        adminEmail: actor.email,
        adminRole: actor.role,
        sessionId: actor.sid,
        workspaceId,
        targetUserId,
        targetEmail,
        ip,
        startedAt: new Date(),
        outcome: ok ? "success" : "failure",
      });
    } catch (logErr) {
      console.error("[impersonate] failed to write impersonation_log:", logErr);
    }

    await recordAudit({
      actor,
      action: "workspace.impersonate",
      target: "workspace",
      targetId: workspaceId,
      metadata: { mode: "direct", targetEmail },
      ip,
      outcome: ok ? "success" : "failure",
    });

    if (!ok || !token) {
      return NextResponse.json({ message: errorMsg || "Impersonation failed" }, { status: 400 });
    }

    const customerPortal = process.env.CUSTOMER_PORTAL_URL || "http://localhost:3000";
    const targetUrl = `${customerPortal}/dashboard`;

    const response = NextResponse.json({ ok: true, targetUrl, token: token || undefined });

    // In prod, set the impersonation auth_token on the shared parent domain so
    // the customer portal picks it up automatically.
    const cookieDomain = process.env.IMPERSONATION_COOKIE_DOMAIN;
    if (token && cookieDomain) {
      response.cookies.set("auth_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        domain: cookieDomain,
        path: "/",
        maxAge: 24 * 60 * 60,
      });
    }

    return response;
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    console.error("[admin/ops/impersonate]", err);
    return NextResponse.json({ message: "Impersonation failed" }, { status: 500 });
  }
}
