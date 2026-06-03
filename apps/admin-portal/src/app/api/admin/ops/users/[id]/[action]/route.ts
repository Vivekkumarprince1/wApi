import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@/server/auth";
import { recordAudit, clientIp } from "@/server/audit";
import { setUserRole, setUserStatus, deleteUser } from "@/server/user-ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * User operations — SELF-CONTAINED direct writes (no gateway). These mirror
 * core-server's adminController user methods, which are plain Mongo updates;
 * we add cache invalidation for freshness.
 *
 *   role     body { role }
 *   status   body { status }   (active|suspended|invited)
 *   disable  -> status=suspended
 *   enable   -> status=active
 *   delete   soft-delete (system capability; refuses super-admin)
 */

type Handler = (id: string, payload: Record<string, unknown>) => Promise<unknown>;

const ACTIONS: Record<string, { capability: Parameters<typeof requireAdmin>[0]; run: Handler }> = {
  role: { capability: "workspaces", run: (id, p) => setUserRole(id, String(p.role)) },
  status: { capability: "workspaces", run: (id, p) => setUserStatus(id, p.status as "active" | "suspended" | "invited") },
  disable: { capability: "workspaces", run: (id) => setUserStatus(id, "suspended") },
  enable: { capability: "workspaces", run: (id) => setUserStatus(id, "active") },
  delete: {
    capability: "system",
    run: async (id) => {
      await deleteUser(id);
      return { deleted: true };
    },
  },
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; action: string }> }
) {
  const { id, action } = await params;
  const config = ACTIONS[action];
  if (!config) {
    return NextResponse.json({ message: `Unknown action "${action}"` }, { status: 400 });
  }

  try {
    const actor = await requireAdmin(config.capability);
    const payload = await req.json().catch(() => ({}));

    const data = await config.run(id, payload);

    await recordAudit({
      actor,
      action: `user.${action}`,
      target: "user",
      targetId: id,
      metadata: { payload, mode: "direct" },
      ip: clientIp(req),
      outcome: "success",
    });

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Operation failed";
    console.error(`[admin/ops/users/${action}]`, err);
    return NextResponse.json({ message }, { status: 500 });
  }
}
