"use strict";
/**
 * Canonical role enum + helpers.
 *
 * Historically the codebase has been sloppy about role strings: gateway
 * sometimes saw 'admin', billing required 'super_admin', the frontend
 * treated 'admin' as a workspace role. This module is the single source
 * of truth — all services should normalise through here.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALL_ADMIN_ROLES = exports.AdminRoles = exports.ALL_ROLES = exports.Roles = void 0;
exports.normalizeRole = normalizeRole;
exports.isPlatformAdmin = isPlatformAdmin;
exports.isWorkspaceAdmin = isWorkspaceAdmin;
exports.roleAtLeast = roleAtLeast;
exports.normalizeAdminRole = normalizeAdminRole;
exports.isAdminRole = isAdminRole;
exports.adminCan = adminCan;
exports.Roles = {
    SuperAdmin: 'super_admin',
    Owner: 'owner',
    Admin: 'admin',
    Manager: 'manager',
    Agent: 'agent',
    Viewer: 'viewer',
};
exports.ALL_ROLES = [
    exports.Roles.SuperAdmin,
    exports.Roles.Owner,
    exports.Roles.Admin,
    exports.Roles.Manager,
    exports.Roles.Agent,
    exports.Roles.Viewer,
];
const ROLE_SET = new Set(exports.ALL_ROLES);
const ALIASES = {
    // Legacy aliases that have appeared in old JWTs / dumps.
    superadmin: exports.Roles.SuperAdmin,
    'super-admin': exports.Roles.SuperAdmin,
    staff: exports.Roles.SuperAdmin,
    workspace_owner: exports.Roles.Owner,
    workspace_admin: exports.Roles.Admin,
    workspace_manager: exports.Roles.Manager,
    team_member: exports.Roles.Agent,
    user: exports.Roles.Agent,
};
/**
 * Returns a canonical role for any incoming string. Unknown values fall
 * back to `viewer`, which is the safest least-privilege role.
 *
 * Crucially, the legacy 'admin' string is **always** a workspace admin —
 * it never silently upgrades to super_admin.
 */
function normalizeRole(input, fallback = exports.Roles.Viewer) {
    if (typeof input !== 'string')
        return fallback;
    const trimmed = input.trim().toLowerCase();
    if (!trimmed)
        return fallback;
    if (ROLE_SET.has(trimmed))
        return trimmed;
    const aliased = ALIASES[trimmed];
    return aliased ?? fallback;
}
function isPlatformAdmin(role) {
    return normalizeRole(role) === exports.Roles.SuperAdmin;
}
const WORKSPACE_ADMIN_ROLES = new Set([
    exports.Roles.Owner,
    exports.Roles.Admin,
]);
function isWorkspaceAdmin(role) {
    return WORKSPACE_ADMIN_ROLES.has(normalizeRole(role));
}
const WORKSPACE_RANK = {
    [exports.Roles.SuperAdmin]: 100, // platform; outranks any workspace role
    [exports.Roles.Owner]: 60,
    [exports.Roles.Admin]: 50,
    [exports.Roles.Manager]: 40,
    [exports.Roles.Agent]: 20,
    [exports.Roles.Viewer]: 10,
};
function roleAtLeast(role, minimum) {
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
exports.AdminRoles = {
    SuperAdmin: 'super_admin',
    Support: 'super_admin_support',
    Finance: 'super_admin_finance',
    ReadOnly: 'super_admin_readonly',
};
exports.ALL_ADMIN_ROLES = [
    exports.AdminRoles.SuperAdmin,
    exports.AdminRoles.Support,
    exports.AdminRoles.Finance,
    exports.AdminRoles.ReadOnly,
];
const ADMIN_ROLE_SET = new Set(exports.ALL_ADMIN_ROLES);
const ADMIN_ALIASES = {
    superadmin: exports.AdminRoles.SuperAdmin,
    'super-admin': exports.AdminRoles.SuperAdmin,
    staff: exports.AdminRoles.SuperAdmin,
    'super_admin_support': exports.AdminRoles.Support,
    'super-admin-support': exports.AdminRoles.Support,
    support: exports.AdminRoles.Support,
    'super_admin_finance': exports.AdminRoles.Finance,
    'super-admin-finance': exports.AdminRoles.Finance,
    finance: exports.AdminRoles.Finance,
    'super_admin_readonly': exports.AdminRoles.ReadOnly,
    'super-admin-readonly': exports.AdminRoles.ReadOnly,
    readonly: exports.AdminRoles.ReadOnly,
    'read-only': exports.AdminRoles.ReadOnly,
};
/**
 * Returns a canonical admin role for any incoming string, or `null` if the
 * value is not an admin role. Used by the admin portal to reject customer
 * roles (owner/admin/agent) at the door.
 */
function normalizeAdminRole(input) {
    if (typeof input !== 'string')
        return null;
    const trimmed = input.trim().toLowerCase();
    if (!trimmed)
        return null;
    if (ADMIN_ROLE_SET.has(trimmed))
        return trimmed;
    return ADMIN_ALIASES[trimmed] ?? null;
}
/** True for any of the four platform-admin roles. */
function isAdminRole(role) {
    return normalizeAdminRole(role) !== null;
}
const ADMIN_CAPABILITIES = {
    [exports.AdminRoles.SuperAdmin]: new Set([
        'read', 'workspaces', 'billing', 'operations', 'system',
    ]),
    [exports.AdminRoles.Support]: new Set(['read', 'workspaces']),
    [exports.AdminRoles.Finance]: new Set(['read', 'billing']),
    [exports.AdminRoles.ReadOnly]: new Set(['read']),
};
/**
 * Whether an admin role is allowed a given capability. Unknown / non-admin
 * roles are denied everything.
 */
function adminCan(role, capability) {
    const normalized = normalizeAdminRole(role);
    if (!normalized)
        return false;
    return ADMIN_CAPABILITIES[normalized].has(capability);
}
