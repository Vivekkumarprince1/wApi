import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@/server/auth";
import { recordAudit, clientIp } from "@/server/audit";
import {
  setWorkspaceBillingStatus,
  setWorkspacePlan,
  setWorkspaceServiceAccess,
  emergencyFreezeWorkspace,
  deleteWorkspace,
} from "@/server/workspace-ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Workspace operations — SELF-CONTAINED direct writes (no gateway).
 * Each handler writes Mongo directly and fires the side-effects the services
 * would (cache invalidation, pub-sub, cross-service cascade for delete), then
 * records the admin audit entry.
 *
 *   suspend / activate  -> billingStatus + cache bust + pub-sub
 *   plan                -> set plan + cache bust + pub-sub   (body: { planId | planSlug })
 *   service-access       -> workspace feature override         (body: { features[] | reset: true })
 *   freeze / unfreeze   -> emergency billingStatus=frozen    (capability: system)
 *   delete              -> full cross-DB + service cascade   (capability: system)
 */

type Handler = (id: string, payload: Record<string, unknown>) => Promise<unknown>;

const ACTIONS: Record<string, { capability: Parameters<typeof requireAdmin>[0]; run: Handler }> = {
  suspend: {
    capability: "workspaces",
    run: (id, p) => setWorkspaceBillingStatus(id, "suspended", p.reason as string | undefined),
  },
  activate: {
    capability: "workspaces",
    run: (id) => setWorkspaceBillingStatus(id, "active"),
  },
  plan: {
    capability: "billing",
    run: (id, p) => setWorkspacePlan(id, p.planId as string | undefined, p.planSlug as string | undefined),
  },
  "service-access": {
    capability: "workspaces",
    run: (id, p) => setWorkspaceServiceAccess(id, p.features, p.reset === true),
  },
  freeze: {
    capability: "system",
    run: (id, p) => emergencyFreezeWorkspace(id, p.reason as string | undefined, false),
  },
  unfreeze: {
    capability: "system",
    run: (id) => emergencyFreezeWorkspace(id, undefined, true),
  },
  delete: {
    capability: "system",
    run: async (id) => {
      await deleteWorkspace(id);
      return { deleted: true, workspaceId: id };
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

    const data = await config.run(id, { ...payload, __actor: actor });

    await recordAudit({
      actor,
      action: `workspace.${action}`,
      target: "workspace",
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
    // Best-effort failure audit.
    try {
      const actor = await requireAdmin(config.capability);
      await recordAudit({
        actor,
        action: `workspace.${action}`,
        target: "workspace",
        targetId: id,
        ip: clientIp(req),
        outcome: "failure",
        metadata: { error: message },
      });
    } catch {
      /* ignore */
    }
    console.error(`[admin/ops/workspaces/${action}]`, err);
    return NextResponse.json({ message }, { status: 500 });
  }
}
