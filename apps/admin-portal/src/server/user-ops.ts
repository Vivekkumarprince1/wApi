import "server-only";
import { coreModels } from "./models";
import { invalidateUserCache } from "./events";

/**
 * Self-contained user operations — direct Mongo writes + cache invalidation.
 * Mirrors core-server's adminController user methods (role/status/delete) which
 * are plain Mongo updates with no BullMQ side-effects.
 */

const VALID_ROLES = ["super_admin", "owner", "admin", "manager", "agent", "member", "viewer"];

export async function setUserRole(userId: string, role: string) {
  if (!VALID_ROLES.includes(role)) throw new Error(`Invalid role: ${role}`);
  const { User } = await coreModels();
  const user = await User.findByIdAndUpdate(userId, { $set: { role } }, { new: true })
    .select("-passwordHash")
    .lean();
  if (!user) throw new Error("User not found");
  await invalidateUserCache(userId);
  return user;
}

export async function setUserStatus(userId: string, status: "active" | "suspended" | "invited") {
  const { User } = await coreModels();
  const update: Record<string, unknown> = { status };
  if (status === "suspended") update.isDeactivated = true;
  if (status === "active") update.isDeactivated = false;

  const user = await User.findByIdAndUpdate(userId, { $set: update }, { new: true })
    .select("-passwordHash")
    .lean();
  if (!user) throw new Error("User not found");
  await invalidateUserCache(userId);
  return user;
}

/** Soft-delete (decommission) a user. Refuses to delete a super-admin. */
export async function deleteUser(userId: string) {
  const { User } = await coreModels();
  const user = (await User.findById(userId).select("-passwordHash").lean()) as { role?: string } | null;
  if (!user) throw new Error("User not found");
  if (user.role === "super_admin") throw new Error("Cannot delete a super-admin user");

  await User.findByIdAndUpdate(userId, {
    $set: { status: "removed", isDeactivated: true, removedAt: new Date() },
  });
  await invalidateUserCache(userId);
}
