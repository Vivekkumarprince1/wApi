import "server-only";
import { Types } from "mongoose";
import { coreModels } from "./models";

/**
 * Self-contained config/plan/settings writes — direct Mongo, no gateway.
 * These are plain document writes in core-server with no BullMQ side-effects.
 */

/* ── System settings (singleton) ──────────────────────────────────────── */

export async function updateSystemSettings(patch: Record<string, unknown>) {
  const { SystemSettings } = await coreModels();
  const allowed = ["maintenanceMode", "maintenanceMessage", "allowNewSignups", "systemNotice"];
  const set: Record<string, unknown> = {};
  for (const k of allowed) if (k in patch) set[k] = patch[k];

  // Merge `features` per-key (dot notation) so writing one flag (compliance
  // overrides, emergency-lockdown, a broadcast) never clobbers the others
  // (aiEnabled, billingEnforced, …) the live platform relies on.
  if (patch.features && typeof patch.features === "object") {
    for (const [k, v] of Object.entries(patch.features as Record<string, unknown>)) {
      set[`features.${k}`] = v;
    }
  }

  const doc = await SystemSettings.findOneAndUpdate({}, { $set: set }, { new: true, upsert: true }).lean();
  return doc;
}

/* ── Plans CRUD ───────────────────────────────────────────────────────── */

export async function createPlan(data: Record<string, unknown>) {
  const { Plan } = await coreModels();
  const plan = await Plan.create(data);
  return plan.toObject();
}

export async function updatePlan(planId: string, data: Record<string, unknown>) {
  const { Plan } = await coreModels();
  const clean = { ...data };
  delete clean.planId;
  delete clean._id;
  const plan = await Plan.findByIdAndUpdate(planId, { $set: clean }, { new: true }).lean();
  if (!plan) throw new Error("Plan not found");
  return plan;
}

export async function deletePlan(planId: string) {
  const { Plan } = await coreModels();
  const res = await Plan.findByIdAndDelete(planId).lean();
  if (!res) throw new Error("Plan not found");
}

/* ── User invite ──────────────────────────────────────────────────────── */

export async function inviteUser(input: { email: string; name?: string; role?: string }) {
  if (!input.email) throw new Error("email is required");
  const { User } = await coreModels();

  const existing = await User.findOne({ email: input.email.toLowerCase().trim() }).lean();
  if (existing) throw new Error("A user with that email already exists");

  const invitationToken = randomToken();
  const user = await User.create({
    email: input.email.toLowerCase().trim(),
    name: input.name || input.email.split("@")[0],
    role: input.role || "member",
    status: "invited",
    invitedAt: new Date(),
    invitationToken,
  });
  return { id: String((user as { _id: unknown })._id), invitationToken };
}

/* ── Gupshup webhook policy upsert ────────────────────────────────────── */

export async function saveWebhookPolicy(input: Record<string, unknown>) {
  const { WebhookPolicy } = await coreModels();
  const { id, ...data } = input;
  if (id) {
    const updated = await WebhookPolicy.findByIdAndUpdate(String(id), data, { new: true }).lean();
    if (!updated) throw new Error("Webhook policy not found");
    return updated;
  }
  const created = await WebhookPolicy.create(data);
  return created.toObject();
}

/* ── Data explorer single-document update ─────────────────────────────── */

export async function updateDocument(collection: string, id: string, update: Record<string, unknown>) {
  const { Workspace } = await coreModels();
  const conn = Workspace.db; // core connection
  const db = conn.db;
  if (!db) throw new Error("core DB unavailable");

  // Guard against dangerous operators in the update payload.
  const json = JSON.stringify(update);
  if (/\$where|\$function|\$accumulator|\$expr/.test(json)) {
    throw new Error("Update contains prohibited operators");
  }

  let _id: Types.ObjectId | string = id;
  try {
    _id = new Types.ObjectId(id);
  } catch {
    /* leave as string if not a valid ObjectId */
  }

  const res = await db.collection(collection).updateOne({ _id } as Record<string, unknown>, { $set: update });
  return { matched: res.matchedCount, modified: res.modifiedCount };
}

function randomToken(): string {
  const bytes = new Uint8Array(24);
  (globalThis.crypto || require("crypto").webcrypto).getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
