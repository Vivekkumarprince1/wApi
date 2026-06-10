import "server-only";
import axios from "axios";
import { Types, type Connection } from "mongoose";
import { getConnection } from "./db";
import { internalDelete } from "./internal-client";
import { invalidateWorkspaceCache } from "./events";

/**
 * Self-contained workspace / account deletion.
 *
 * Faithful port of core-server's AccountDeletionService
 * (services/core-server/src/services/auth/account-deletion-service.ts):
 *   1. External cleanup OUTSIDE any transaction:
 *        - cross-service purge via the services' own /internal/purge endpoints
 *        - Gupshup subscription de-registration (best-effort)
 *   2. DB purge INSIDE a transaction: ~35 core collections + the workspace doc
 *   3. Cache invalidation
 *
 * The portal performs these directly (Rule: fully self-contained) rather than
 * delegating to the gateway.
 */

// Collections purged for a workspace, with the field that references it.
// Mirrors AccountDeletionService.modelsToPurge (by raw collection name so we
// don't need a model for every one).
const WORKSPACE_COLLECTIONS: { collection: string; field: string }[] = [
  { collection: "contacts", field: "workspace" },
  { collection: "contactevents", field: "workspace" },
  { collection: "conversations", field: "workspace" },
  { collection: "conversationledgers", field: "workspace" },
  { collection: "messages", field: "workspace" },
  { collection: "quickreplies", field: "workspace" },
  { collection: "tags", field: "workspace" },
  { collection: "templates", field: "workspace" },
  { collection: "templatemetrics", field: "workspace" },
  { collection: "deals", field: "workspace" },
  { collection: "pipelines", field: "workspace" },
  { collection: "products", field: "workspace" },
  { collection: "tasks", field: "workspace" },
  { collection: "dailyanalytics", field: "workspace" },
  { collection: "agentdailyanalytics", field: "workspace" },
  { collection: "usageledgers", field: "workspace" },
  { collection: "whatsappads", field: "workspace" },
  { collection: "workspaceintegrations", field: "workspace" },
  { collection: "widgetconfigs", field: "workspace" },
  { collection: "businesses", field: "workspace" },
  { collection: "onboardingstates", field: "workspace" },
  { collection: "internalnotes", field: "workspace" },
  { collection: "teams", field: "workspace" },
  { collection: "workspaceinvitations", field: "workspace" },
  { collection: "webhooklogs", field: "workspace" },
  { collection: "orders", field: "workspaceId" },
  { collection: "checkoutcarts", field: "workspaceId" },
  { collection: "formsubmissions", field: "workspace" },
  { collection: "instagramquickflows", field: "workspace" },
  { collection: "instagramquickflowlogs", field: "workspace" },
  { collection: "whatsappflows", field: "workspace" },
  { collection: "supporttickets", field: "workspace" },
  { collection: "macros", field: "workspace" },
  { collection: "notifications", field: "workspace" },
];

interface WorkspaceDoc {
  _id: unknown;
  name?: string;
  owner?: unknown;
  gupshupAppId?: string;
  gupshupIdentity?: { partnerAppId?: string };
}

/** Delete a single workspace and everything it owns (cross-service + DB). */
export async function deleteWorkspaceCascade(workspaceId: string): Promise<void> {
  const conn = await getConnection("core");
  const db = conn.db;
  if (!db) throw new Error("core DB unavailable");

  const workspace = (await db.collection("workspaces").findOne({
    _id: new Types.ObjectId(workspaceId),
  })) as WorkspaceDoc | null;
  if (!workspace) throw new Error("Workspace not found");

  // 1. External cleanup OUTSIDE any transaction.
  await purgeMicroserviceData(workspaceId);
  await cleanupGupshup(workspace);

  // 2. DB purge inside a transaction.
  await purgeWorkspaceDb(conn, workspaceId, workspace);

  // 3. Bust caches.
  await invalidateWorkspaceCache(workspaceId);
}

/**
 * Delete a full account: every workspace the user owns, then the user. Mirrors
 * AccountDeletionService.deleteAccount.
 */
export async function deleteAccountCascade(ownerId: string): Promise<void> {
  const conn = await getConnection("core");
  const db = conn.db;
  if (!db) throw new Error("core DB unavailable");

  const ownerObjId = new Types.ObjectId(ownerId);
  const owned = (await db
    .collection("workspaces")
    .find({ owner: ownerObjId })
    .toArray()) as WorkspaceDoc[];

  for (const ws of owned) {
    await purgeMicroserviceData(String(ws._id));
    await cleanupGupshup(ws);
  }

  for (const ws of owned) {
    await purgeWorkspaceDb(conn, String(ws._id), ws);
    await invalidateWorkspaceCache(String(ws._id));
  }

  // Remove the user from any teams they belong to, then delete the user.
  await db
    .collection("teams")
    .updateMany({ "members.user": ownerObjId }, { $pull: { members: { user: ownerObjId } } } as never);
  await db.collection("users").deleteOne({ _id: ownerObjId });
}

/* ── helpers ──────────────────────────────────────────────────────────── */

async function purgeWorkspaceDb(conn: Connection, workspaceId: string, workspace: WorkspaceDoc) {
  const db = conn.db!;
  const wsObjId = new Types.ObjectId(workspaceId);
  const gupshupAppId = workspace.gupshupAppId || workspace.gupshupIdentity?.partnerAppId;

  const session = await conn.startSession();
  try {
    await session.withTransaction(async () => {
      // Local Gupshup record cleanup (disconnect, don't delete the app pool entry).
      if (gupshupAppId && !String(gupshupAppId).startsWith("mock_")) {
        await db.collection("gupshupapps").updateOne(
          { gupshupAppId },
          { $set: { assigned: false, assignedToWorkspace: null, assignedToBusiness: null, status: "disconnected" } },
          { session }
        );
        await db.collection("businessappmaps").updateMany(
          { workspace: wsObjId, gupshupAppId },
          { $set: { active: false, disconnectedAt: new Date() } },
          { session }
        );
      }

      await Promise.all(
        WORKSPACE_COLLECTIONS.map(({ collection, field }) =>
          db.collection(collection).deleteMany({ [field]: wsObjId }, { session })
        )
      );

      await db.collection("workspaces").deleteOne({ _id: wsObjId }, { session });
    });
  } finally {
    await session.endSession();
  }
}

async function purgeMicroserviceData(workspaceId: string) {
  // Same internal endpoints core-server calls.
  await internalDelete("automation", `/api/automation/engine/internal/purge/${workspaceId}`);
  await internalDelete("campaign", `/api/campaign/internal/purge/${workspaceId}`);
}

/**
 * Best-effort Gupshup subscription de-registration. Uses the partner login
 * flow if creds are configured; logs and continues otherwise (matching the
 * service's "don't block deletion on Gupshup" behaviour).
 */
async function cleanupGupshup(workspace: WorkspaceDoc) {
  const appId = workspace.gupshupAppId || workspace.gupshupIdentity?.partnerAppId;
  if (!appId || String(appId).startsWith("mock_")) return;

  const base = (process.env.GUPSHUP_PARTNER_BASE_URL || "https://partner.gupshup.io").replace(/\/$/, "");
  const email = process.env.GUPSHUP_PARTNER_EMAIL;
  const password = process.env.GUPSHUP_PARTNER_PASSWORD;
  if (!email || !password) {
    console.warn(`[admin-portal/deletion] Gupshup partner creds not set — skipping de-registration for app ${appId}`);
    return;
  }

  try {
    const form = new URLSearchParams({ email, password });
    const login = await axios.post(`${base}/partner/account/login`, form, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: 10000,
    });
    const token = login.data?.token;
    if (!token) return;

    const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
    const subs = await axios
      .get(`${base}/partner/app/${appId}/subscription`, { headers, timeout: 10000 })
      .then((r) => r.data?.subscriptions || r.data || [])
      .catch(() => []);

    if (Array.isArray(subs)) {
      for (const sub of subs) {
        const subId = sub.id || sub.subscriptionId || sub.data?.id;
        if (!subId) continue;
        await axios
          .delete(`${base}/partner/app/${appId}/subscription/${subId}`, { headers, timeout: 10000 })
          .catch((e) => console.warn(`[admin-portal/deletion] Gupshup sub ${subId} delete failed:`, e.message));
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  } catch (err) {
    console.error(`[admin-portal/deletion] Gupshup cleanup failed for app ${appId}:`, (err as Error).message);
  }
}
