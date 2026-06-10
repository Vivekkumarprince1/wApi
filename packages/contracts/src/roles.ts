/**
 * Canonical role enum + helpers.
 *
 * Historically the codebase has been sloppy about role strings: gateway
 * sometimes saw 'admin', billing required 'super_admin', the frontend
 * treated 'admin' as a workspace role. This module is the single source
 * of truth — all services should normalise through here.
 */

export const Roles = {
  SuperAdmin: 'super_admin',
  Owner: 'owner',
  Admin: 'admin',
  Manager: 'manager',
  Agent: 'agent',
  Viewer: 'viewer',
} as const;

export type Role = (typeof Roles)[keyof typeof Roles];

export const ALL_ROLES: readonly Role[] = [
  Roles.SuperAdmin,
  Roles.Owner,
  Roles.Admin,
  Roles.Manager,
  Roles.Agent,
  Roles.Viewer,
];

const ROLE_SET = new Set<string>(ALL_ROLES);

const ALIASES: Record<string, Role> = {
  // Legacy aliases that have appeared in old JWTs / dumps.
  superadmin: Roles.SuperAdmin,
  'super-admin': Roles.SuperAdmin,
  staff: Roles.SuperAdmin,
  workspace_owner: Roles.Owner,
  workspace_admin: Roles.Admin,
  workspace_manager: Roles.Manager,
  team_member: Roles.Agent,
  user: Roles.Agent,
};

/**
 * Returns a canonical role for any incoming string. Unknown values fall
 * back to `viewer`, which is the safest least-privilege role.
 *
 * Crucially, the legacy 'admin' string is **always** a workspace admin —
 * it never silently upgrades to super_admin.
 */
export function normalizeRole(input: unknown, fallback: Role = Roles.Viewer): Role {
  if (typeof input !== 'string') return fallback;
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return fallback;
  if (ROLE_SET.has(trimmed)) return trimmed as Role;
  const aliased = ALIASES[trimmed];
  return aliased ?? fallback;
}

export function isPlatformAdmin(role: unknown): boolean {
  return normalizeRole(role) === Roles.SuperAdmin;
}

const WORKSPACE_ADMIN_ROLES = new Set<Role>([
  Roles.Owner,
  Roles.Admin,
]);

export function isWorkspaceAdmin(role: unknown): boolean {
  return WORKSPACE_ADMIN_ROLES.has(normalizeRole(role));
}

const WORKSPACE_RANK: Record<Role, number> = {
  [Roles.SuperAdmin]: 100, // platform; outranks any workspace role
  [Roles.Owner]: 60,
  [Roles.Admin]: 50,
  [Roles.Manager]: 40,
  [Roles.Agent]: 20,
  [Roles.Viewer]: 10,
};

export function roleAtLeast(role: unknown, minimum: Role): boolean {
  return WORKSPACE_RANK[normalizeRole(role)] >= WORKSPACE_RANK[minimum];
}

/* ------------------------------------------------------------------ *
 * Platform admin roles (Super Admin Portal)
 *
 * These are distinct from the workspace roles above. They gate access
 * to the standalone admin portal (`apps/admin-portal`) only — customer
 * workspace roles (owner/admin/agent/...) are NEVER accepted there.
 *
 * `super_admin` is the existing canonical platform role and remains the
 * full-privilege role. The three scoped roles below are subsets used to
 * grant least-privilege access to support / finance / read-only staff.
 * ------------------------------------------------------------------ */

export const AdminRoles = {
  SuperAdmin: 'super_admin',
  Support: 'super_admin_support',
  Finance: 'super_admin_finance',
  ReadOnly: 'super_admin_readonly',
} as const;

export type AdminRole = (typeof AdminRoles)[keyof typeof AdminRoles];

export const ALL_ADMIN_ROLES: readonly AdminRole[] = [
  AdminRoles.SuperAdmin,
  AdminRoles.Support,
  AdminRoles.Finance,
  AdminRoles.ReadOnly,
];

const ADMIN_ROLE_SET = new Set<string>(ALL_ADMIN_ROLES);

const ADMIN_ALIASES: Record<string, AdminRole> = {
  superadmin: AdminRoles.SuperAdmin,
  'super-admin': AdminRoles.SuperAdmin,
  staff: AdminRoles.SuperAdmin,
  'super_admin_support': AdminRoles.Support,
  'super-admin-support': AdminRoles.Support,
  support: AdminRoles.Support,
  'super_admin_finance': AdminRoles.Finance,
  'super-admin-finance': AdminRoles.Finance,
  finance: AdminRoles.Finance,
  'super_admin_readonly': AdminRoles.ReadOnly,
  'super-admin-readonly': AdminRoles.ReadOnly,
  readonly: AdminRoles.ReadOnly,
  'read-only': AdminRoles.ReadOnly,
};

/**
 * Returns a canonical admin role for any incoming string, or `null` if the
 * value is not an admin role. Used by the admin portal to reject customer
 * roles (owner/admin/agent) at the door.
 */
export function normalizeAdminRole(input: unknown): AdminRole | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;
  if (ADMIN_ROLE_SET.has(trimmed)) return trimmed as AdminRole;
  return ADMIN_ALIASES[trimmed] ?? null;
}

/** True for any of the four platform-admin roles. */
export function isAdminRole(role: unknown): boolean {
  return normalizeAdminRole(role) !== null;
}

/**
 * Capabilities the admin portal gates on. Keep this list small and
 * coarse — fine-grained per-endpoint checks layer on top in the portal.
 */
export type AdminCapability =
  | 'read'        // dashboards, lists, analytics, monitoring, audit logs
  | 'workspaces'  // suspend / activate / impersonate workspaces, users
  | 'billing'     // plans, refunds, wallet/billing operations
  | 'operations'  // campaign/automation/gupshup/webhook control
  | 'system';     // global settings, emergency freeze, compliance

const ADMIN_CAPABILITIES: Record<AdminRole, ReadonlySet<AdminCapability>> = {
  [AdminRoles.SuperAdmin]: new Set<AdminCapability>([
    'read', 'workspaces', 'billing', 'operations', 'system',
  ]),
  [AdminRoles.Support]: new Set<AdminCapability>(['read', 'workspaces']),
  [AdminRoles.Finance]: new Set<AdminCapability>(['read', 'billing']),
  [AdminRoles.ReadOnly]: new Set<AdminCapability>(['read']),
};

/**
 * Whether an admin role is allowed a given capability. Unknown / non-admin
 * roles are denied everything.
 */
export function adminCan(role: unknown, capability: AdminCapability): boolean {
  const normalized = normalizeAdminRole(role);
  if (!normalized) return false;
  return ADMIN_CAPABILITIES[normalized].has(capability);
}
