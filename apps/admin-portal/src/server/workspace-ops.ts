import "server-only";
import { Types } from "mongoose";
import { coreModels } from "./models";
import { getConnection } from "./db";
import { invalidateWorkspaceCache, publish } from "./events";
import { deleteWorkspaceCascade, deleteAccountCascade } from "./account-deletion";
import { signImpersonationToken } from "./internal-client";

/**
 * Self-contained workspace operations — direct Mongo writes + the side-effects
 * the services would normally fire (cache invalidation + pub-sub), so the
 * platform stays consistent without routing through the gateway.
 */

export async function setWorkspaceBillingStatus(
  workspaceId: string,
  billingStatus: "active" | "suspended",
  suspensionReason?: string
) {
  const { Workspace } = await coreModels();
  const update: Record<string, unknown> = { billingStatus };
  if (billingStatus === "suspended" && suspensionReason) update.suspensionReason = suspensionReason;
  if (billingStatus === "active") update.suspensionReason = null;

  const ws = await Workspace.findByIdAndUpdate(workspaceId, { $set: update }, { new: true }).lean();
  if (!ws) throw new Error("Workspace not found");

  await invalidateWorkspaceCache(workspaceId);
  await publish("workspace:status-changed", { workspaceId, billingStatus });
  return ws;
}

/**
 * Emergency freeze — sets billingStatus to "frozen" and records the reason.
 * Mirrors core-server adminController.emergencyFreeze. Self-contained: direct
 * write + cache invalidation + pub-sub so downstream services pick it up.
 * Pass `unfreeze: true` to restore the workspace to "active".
 */
export async function emergencyFreezeWorkspace(
  workspaceId: string,
  reason?: string,
  unfreeze = false
) {
  const { Workspace } = await coreModels();
  const update: Record<string, unknown> = unfreeze
    ? { billingStatus: "active", "metadata.freezeReason": null, "metadata.frozenAt": null }
    : {
        billingStatus: "frozen",
        "metadata.freezeReason": reason || "Emergency admin action",
        "metadata.frozenAt": new Date(),
      };

  const ws = await Workspace.findByIdAndUpdate(workspaceId, { $set: update }, { new: true }).lean();
  if (!ws) throw new Error("Workspace not found");

  await invalidateWorkspaceCache(workspaceId);
  await publish("workspace:status-changed", {
    workspaceId,
    billingStatus: unfreeze ? "active" : "frozen",
  });
  return ws;
}

/**
 * Repair entitlement drift — re-applies each workspace's plan feature set onto
 * its planLimits.features so the effective entitlements match the catalogue.
 * Self-contained Mongo write. Optionally scoped to a single workspace.
 *
 * (The core-server variant re-syncs Gupshup app assignments, which requires the
 * BSP services; here we repair the feature-entitlement drift the portal can
 * compute and fix directly.)
 */
export async function repairSubscriptions(workspaceId?: string) {
  const { Plan, Workspace } = await coreModels();

  const plans = await Plan.find({}).select("features").lean();
  const planFeatures = new Map(
    (plans as Array<Record<string, unknown>>).map((p) => [
      String(p._id),
      Array.isArray(p.features) ? (p.features as string[]) : [],
    ])
  );

  const filter: Record<string, unknown> = workspaceId ? { _id: workspaceId } : {};
  const workspaces = await Workspace.find(filter).select("name plan planLimits").lean();

  const results = { total: workspaces.length, processed: 0, repaired: 0, failed: 0, details: [] as unknown[] };

  for (const ws of workspaces as Array<Record<string, unknown>>) {
    try {
      const planId = String(ws.plan || "");
      const expected = planFeatures.get(planId) || [];
      const limits = (ws.planLimits || {}) as Record<string, unknown>;
      // Only an EXPLICIT feature override can drift. A workspace with no
      // override inherits the plan catalogue, so it is never drifted — matching
      // the read-side detector (read/entitlement-drift). This avoids writing
      // entitlements onto workspaces that were correctly inheriting.
      const hasExplicit = Array.isArray(limits.features);
      const current: string[] = hasExplicit ? (limits.features as string[]) : expected;

      const drifted =
        hasExplicit &&
        (expected.some((f) => !current.includes(f)) || current.some((f) => !expected.includes(f)));

      results.processed++;
      if (drifted && expected.length) {
        await Workspace.updateOne(
          { _id: ws._id },
          { $set: { "planLimits.features": expected } }
        );
        await invalidateWorkspaceCache(String(ws._id));
        results.repaired++;
        results.details.push({ id: String(ws._id), name: ws.name, appliedFeatures: expected });
      }
    } catch (e) {
      results.failed++;
      results.details.push({
        id: String(ws._id),
        name: ws.name,
        error: e instanceof Error ? e.message : "repair failed",
      });
    }
  }

  return results;
}

export async function setWorkspacePlan(workspaceId: string, planId?: string, planSlug?: string) {
  const { Workspace, Plan } = await coreModels();
  const plan = planId
    ? await Plan.findById(planId).lean()
    : planSlug
      ? await Plan.findOne({ slug: planSlug }).lean()
      : null;
  if (!plan) throw new Error("Plan not found");

  const ws = await Workspace.findByIdAndUpdate(
    workspaceId,
    {
      $set: { plan: new Types.ObjectId(String((plan as { _id: unknown })._id)) },
      // A plan change should start from that plan's entitlements. An admin can
      // subsequently apply a new workspace-specific service override.
      $unset: { "planLimits.features": 1 },
    },
    { new: true }
  )
    .populate("plan")
    .lean();
  if (!ws) throw new Error("Workspace not found");

  await syncBillingWorkspacePlan(workspaceId, String((plan as { _id: unknown })._id));

  await invalidateWorkspaceCache(workspaceId);
  await publish("workspace:plan-changed", { workspaceId, planId: String((plan as { _id: unknown })._id) });
  return ws;
}

/**
 * Billing keeps a minimal workspace and subscription projection in its own
 * database. Keep that projection aligned with the core workspace plan so the
 * billing dashboard never falls back to the default Free Tier.
 */
export async function syncBillingWorkspacePlan(workspaceId: string, planId: string) {
  if (!Types.ObjectId.isValid(workspaceId) || !Types.ObjectId.isValid(planId)) {
    throw new Error("Workspace and plan ids must be valid ObjectIds");
  }

  const billing = await getConnection("billing");
  if (!billing.db) throw new Error("billing DB unavailable");
  const workspaceObjectId = new Types.ObjectId(workspaceId);
  const planObjectId = new Types.ObjectId(planId);
  const now = new Date();
  const nextPeriod = new Date(now);
  nextPeriod.setMonth(nextPeriod.getMonth() + 1);

  await Promise.all([
    billing.db.collection("workspaces").updateOne(
      { _id: workspaceObjectId },
      { $set: { planId: planObjectId, billingStatus: "active", updatedAt: now }, $setOnInsert: { createdAt: now, autoPay: false, taxId: "" } },
      { upsert: true },
    ),
    billing.db.collection("subscriptions").updateOne(
      { workspaceId: workspaceObjectId, status: { $in: ["trialing", "active", "past_due"] } },
      { $set: { planId: planObjectId, status: "active", currentPeriodStart: now, currentPeriodEnd: nextPeriod, updatedAt: now }, $setOnInsert: { workspaceId: workspaceObjectId, cancelAtPeriodEnd: false, createdAt: now } },
      { upsert: true },
    ),
  ]);
}

export async function setWorkspaceServiceAccess(workspaceId: string, features?: unknown, reset = false) {
  const { Workspace } = await coreModels();
  if (!reset && !Array.isArray(features)) throw new Error("features must be an array");
  const requestedFeatures = Array.isArray(features) ? features : [];

  const validFeatures = reset
    ? []
    : [...new Set(requestedFeatures)].filter(
        (feature): feature is string => typeof feature === "string" && /^[A-Z][A-Z0-9_]{1,63}$/.test(feature)
      );
  if (!reset && validFeatures.length !== requestedFeatures.length) {
    throw new Error("One or more requested services are invalid");
  }

  const update = reset
    ? { $unset: { "planLimits.features": 1 } }
    : { $set: { "planLimits.features": validFeatures } };
  const ws = await Workspace.findByIdAndUpdate(workspaceId, update, { new: true }).lean();
  if (!ws) throw new Error("Workspace not found");

  await invalidateWorkspaceCache(workspaceId);
  await publish("workspace:service-access-changed", { workspaceId, features: reset ? null : validFeatures });
  return ws;
}

/** Full destructive delete — cascades across all DBs + services (self-contained). */
export async function deleteWorkspace(workspaceId: string) {
  const { Workspace, User } = await coreModels();
  const ws = (await Workspace.findById(workspaceId).lean()) as { _id: unknown; owner?: unknown } | null;
  if (!ws) throw new Error("Workspace not found");

  if (ws.owner) {
    const owner = (await User.findById(String(ws.owner)).lean()) as { role?: string } | null;
    // Never delete a super-admin's account; only the workspace.
    if (owner && owner.role === "super_admin") {
      await deleteWorkspaceCascade(workspaceId);
    } else {
      await deleteAccountCascade(String(ws.owner));
    }
  } else {
    await deleteWorkspaceCascade(workspaceId);
  }
}

/** Mint an impersonation token for a workspace's owner (no gateway). */
export async function impersonateWorkspace(workspaceId: string, adminId: string) {
  const { Workspace, User } = await coreModels();
  const ws = (await Workspace.findById(workspaceId).lean()) as { _id: unknown; name?: string; owner?: unknown } | null;
  if (!ws) throw new Error("Workspace not found");

  // Resolve the user to impersonate. The workspace's own `owner` reference is
  // the source of truth; older/self-provisioned workspaces don't always have a
  // member carrying the literal `role: "owner"` (e.g. a super_admin owner), so
  // fall back to a role-based lookup, then to any member of the workspace.
  type OwnerLean = { _id: unknown; email?: string } | null;
  let owner: OwnerLean = null;
  if (ws.owner) {
    owner = (await User.findById(String(ws.owner)).select("email").lean()) as OwnerLean;
  }
  if (!owner) {
    owner = (await User.findOne({ workspace: new Types.ObjectId(workspaceId), role: "owner" })
      .select("email")
      .lean()) as OwnerLean;
  }
  if (!owner) {
    owner = (await User.findOne({ workspace: new Types.ObjectId(workspaceId) })
      .select("email")
      .lean()) as OwnerLean;
  }
  if (!owner) throw new Error("No user found to impersonate for this workspace");

  const token = signImpersonationToken({
    targetUserId: String(owner._id),
    adminId,
    workspaceId,
  });

  return { token, targetUserId: String(owner._id), targetEmail: owner.email, workspaceName: ws.name };
}
