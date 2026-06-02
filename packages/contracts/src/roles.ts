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
