import type { AuthUser, PermissionFlag, UserRole } from "@/types/career";

export const demoAccounts = [
  { label: "Candidate", email: "asha.sharma@example.com", password: "Password@123", route: "/my-applications" },
  { label: "Employee", email: "employee@connectsphere.example", password: "Password@123", route: "/employee/profile" },
  { label: "HR", email: "hr@connectsphere.example", password: "Password@123", route: "/admin/dashboard" },
  { label: "Admin", email: "admin@connectsphere.example", password: "Password@123", route: "/admin/dashboard" },
  { label: "Super admin", email: "super@connectsphere.example", password: "Password@123", route: "/admin/audit-logs" },
  { label: "Unverified", email: "unverified@connectsphere.example", password: "Password@123", route: "/verify-email" },
];

export function roleLabel(role: UserRole) {
  return role === "super-admin" ? "Super admin" : role.charAt(0).toUpperCase() + role.slice(1);
}

export function isAdminUser(user: AuthUser | null | undefined) {
  return user?.role === "admin" || user?.role === "super-admin";
}

export function isSuperAdminUser(user: AuthUser | null | undefined) {
  return user?.role === "super-admin";
}

export function isEmployeeUser(user: AuthUser | null | undefined) {
  return user?.role === "employee";
}

export function isHRUser(user: AuthUser | null | undefined) {
  if (!user) return false;
  return (
    isAdminUser(user) ||
    user.department?.toUpperCase() === "HR" ||
    user.department === "General Management/Administration"
  );
}

export function hasPermission(user: AuthUser | null | undefined, permission: PermissionFlag) {
  if (!user || user.status === "suspended") return false;
  if (isAdminUser(user)) return true;
  return Boolean(user.permissions[permission]);
}

export function canAccessAdminArea(user: AuthUser | null | undefined) {
  return Boolean(user && (isAdminUser(user) || (isHRUser(user) && hasPermission(user, "canAccessDashboard"))));
}

export function defaultRouteForUser(user: AuthUser) {
  if (canAccessAdminArea(user)) return "/admin/dashboard";
  if (user.role === "employee") return "/employee/profile";
  return "/my-applications";
}
