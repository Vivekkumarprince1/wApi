import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AuthUser, PermissionFlag, UserRole } from "@/types/career";
import {
  canAccessAdminArea,
  hasPermission,
  isEmployeeUser,
  isSuperAdminUser,
} from "@/lib/auth-store";
import { SESSION_COOKIE, readSessionToken } from "@/lib/session";

export async function getCurrentUser() {
  const cookieStore = await cookies();
  return readSessionToken(cookieStore.get(SESSION_COOKIE)?.value);
}

export async function requireUser(options?: {
  from?: string;
  roles?: UserRole[];
  permission?: PermissionFlag;
  anyPermission?: PermissionFlag[];
  adminAccess?: boolean;
  employeeOnly?: boolean;
  superAdminOnly?: boolean;
  verified?: boolean;
}) {
  const user = await getCurrentUser();
  const from = encodeURIComponent(options?.from || "/dashboard");

  if (!user) {
    redirect(`/login?from=${from}`);
  }

  if (options?.verified !== false && !user.verified) {
    redirect(`/verify-email?email=${encodeURIComponent(user.email)}&from=${from}`);
  }

  if (options?.roles && !options.roles.includes(user.role)) {
    redirect(`/unauthorized?from=${from}`);
  }

  if (options?.employeeOnly) {
    const eligible = isEmployeeUser(user) && (user.status === "active" || user.status === "former");
    if (!eligible) redirect(`/unauthorized?from=${from}`);
  }

  if (options?.superAdminOnly && !isSuperAdminUser(user)) {
    redirect(`/unauthorized?from=${from}`);
  }

  if (options?.adminAccess && !canAccessAdminArea(user)) {
    redirect(`/unauthorized?from=${from}`);
  }

  if (options?.permission && !hasPermission(user, options.permission)) {
    redirect(`/unauthorized?from=${from}&permission=${options.permission}`);
  }

  if (options?.anyPermission?.length && !options.anyPermission.some((permission) => hasPermission(user, permission))) {
    redirect(`/unauthorized?from=${from}`);
  }

  return user satisfies AuthUser;
}
