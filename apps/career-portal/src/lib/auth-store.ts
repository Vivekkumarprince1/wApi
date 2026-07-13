import type { AuthUser, PermissionFlag, PermissionSet, UserRole } from "@/types/career";
import type { RegisterInput, ResetPasswordInput } from "@/lib/validators";

type StoredUser = AuthUser & {
  password: string;
  otp?: string;
  otpExpiresAt?: string;
};

export const permissionFlags: PermissionFlag[] = [
  "canGenerateCertificate",
  "canGenerateOfferLetter",
  "canCreateJob",
  "canViewApplicants",
  "canManageReviews",
  "canManageEmployees",
  "canManageRecommendations",
  "canAccessDashboard",
];

export const emptyPermissions = (): PermissionSet =>
  Object.fromEntries(permissionFlags.map((flag) => [flag, false])) as PermissionSet;

export const allPermissions = (): PermissionSet =>
  Object.fromEntries(permissionFlags.map((flag) => [flag, true])) as PermissionSet;

const withPermissions = (flags: PermissionFlag[]): PermissionSet => ({
  ...emptyPermissions(),
  ...Object.fromEntries(flags.map((flag) => [flag, true])),
});

const seedUsers: StoredUser[] = [
  {
    id: "user_asha",
    name: "Asha Sharma",
    email: "asha.sharma@example.com",
    phone: "+919876543210",
    role: "user",
    status: "active",
    department: "Candidate",
    position: "Applicant",
    verified: true,
    permissions: emptyPermissions(),
    password: "Password@123",
  },
  {
    id: "emp_tara",
    name: "Tara Singh",
    email: "employee@connectsphere.example",
    phone: "+919998887776",
    role: "employee",
    status: "active",
    department: "Customer Success",
    position: "Customer Success Associate",
    manager: "Ishaan Kapoor",
    verified: true,
    permissions: emptyPermissions(),
    password: "Password@123",
  },
  {
    id: "hr_mira",
    name: "Mira Bedi",
    email: "hr@connectsphere.example",
    phone: "+918887776665",
    role: "employee",
    status: "active",
    department: "HR",
    position: "People Operations Lead",
    manager: "COO",
    verified: true,
    permissions: withPermissions([
      "canAccessDashboard",
      "canCreateJob",
      "canViewApplicants",
      "canGenerateCertificate",
      "canGenerateOfferLetter",
      "canManageReviews",
      "canManageRecommendations",
    ]),
    assignedJobIds: ["job_cs_product_engineer", "job_customer_success", "job_ops_associate"],
    password: "Password@123",
  },
  {
    id: "admin_aparna",
    name: "Aparna Mehta",
    email: "admin@connectsphere.example",
    phone: "+917776665554",
    role: "admin",
    status: "active",
    department: "General Management/Administration",
    position: "Hiring Admin",
    manager: "CEO",
    verified: true,
    permissions: allPermissions(),
    password: "Password@123",
  },
  {
    id: "super_ishaan",
    name: "Ishaan Kapoor",
    email: "super@connectsphere.example",
    phone: "+916665554443",
    role: "super-admin",
    status: "active",
    department: "Executive",
    position: "Super Admin",
    manager: "Board",
    verified: true,
    permissions: allPermissions(),
    password: "Password@123",
  },
  {
    id: "user_unverified",
    name: "Unverified Candidate",
    email: "unverified@connectsphere.example",
    phone: "+915554443332",
    role: "user",
    status: "active",
    department: "Candidate",
    position: "Applicant",
    verified: false,
    permissions: emptyPermissions(),
    password: "Password@123",
    otp: "123456",
    otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  },
];

const cloneSeed = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const authGlobal = globalThis as typeof globalThis & {
  __connectSphereCareerUsers?: StoredUser[];
};

const mutableUsers = authGlobal.__connectSphereCareerUsers ?? (authGlobal.__connectSphereCareerUsers = cloneSeed(seedUsers));

export function sanitizeUser(user: StoredUser): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    department: user.department,
    position: user.position,
    manager: user.manager,
    verified: user.verified,
    permissions: user.permissions,
    assignedJobIds: user.assignedJobIds,
  };
}

export function listAuthUsers() {
  return mutableUsers.map(sanitizeUser);
}

export function findAuthUserByEmail(email: string) {
  return mutableUsers.find((user) => user.email.toLowerCase() === email.toLowerCase());
}

export function findAuthUserById(id: string) {
  return mutableUsers.find((user) => user.id === id);
}

export function authenticateUser(email: string, password: string) {
  const user = findAuthUserByEmail(email);
  if (!user || user.password !== password) {
    throw new Error("Invalid email or password.");
  }
  if (user.status === "suspended") {
    throw new Error("This account is suspended. Contact HR support.");
  }
  return sanitizeUser(user);
}

export function registerCandidate(input: RegisterInput) {
  const existing = findAuthUserByEmail(input.email);
  if (existing) {
    throw new Error("An account with this email already exists.");
  }

  const user: StoredUser = {
    id: `user_${crypto.randomUUID()}`,
    name: input.name,
    email: input.email,
    phone: input.phone || undefined,
    role: "user",
    status: "active",
    department: "Candidate",
    position: "Applicant",
    verified: false,
    permissions: emptyPermissions(),
    password: input.password,
    otp: "123456",
    otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  };

  mutableUsers.push(user);
  return sanitizeUser(user);
}

export function verifyUserEmail(email: string, otp: string) {
  const user = findAuthUserByEmail(email);
  if (!user) {
    throw new Error("Verification challenge not found.");
  }
  if (user.verified) {
    return sanitizeUser(user);
  }
  if (user.otp !== otp || !user.otpExpiresAt || Date.parse(user.otpExpiresAt) < Date.now()) {
    throw new Error("OTP is invalid or expired.");
  }

  user.verified = true;
  user.otp = undefined;
  user.otpExpiresAt = undefined;
  return sanitizeUser(user);
}

export function resendOtp(email: string) {
  const user = findAuthUserByEmail(email);
  if (user) {
    user.otp = "123456";
    user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  }
}

export function resetPassword(input: ResetPasswordInput) {
  const user = findAuthUserByEmail(input.email);
  if (!user || user.otp !== input.otp || !user.otpExpiresAt || Date.parse(user.otpExpiresAt) < Date.now()) {
    throw new Error("OTP is invalid or expired.");
  }
  user.password = input.newPassword;
  user.otp = undefined;
  user.otpExpiresAt = undefined;
  return sanitizeUser(user);
}

export function updateAuthUser(
  id: string,
  input: Partial<Pick<AuthUser, "status" | "role" | "department" | "position" | "manager" | "permissions" | "assignedJobIds">>
) {
  const user = findAuthUserById(id);
  if (!user) throw new Error("User not found.");

  if (input.status) user.status = input.status;
  if (input.role) user.role = input.role;
  if (input.department !== undefined) user.department = input.department;
  if (input.position !== undefined) user.position = input.position;
  if (input.manager !== undefined) user.manager = input.manager;
  if (input.permissions) user.permissions = input.permissions;
  if (input.assignedJobIds) user.assignedJobIds = input.assignedJobIds;

  return sanitizeUser(user);
}

export function deleteAuthUser(id: string) {
  const index = mutableUsers.findIndex((user) => user.id === id);
  if (index === -1) throw new Error("User not found.");
  mutableUsers.splice(index, 1);
  return { deleted: true };
}

export function createHrUser(input: {
  name: string;
  email: string;
  phone?: string;
  department: string;
  position: string;
  manager?: string;
  permissions: PermissionSet;
}) {
  if (findAuthUserByEmail(input.email)) {
    throw new Error("A user with this email already exists.");
  }

  const user: StoredUser = {
    id: `hr_${crypto.randomUUID()}`,
    name: input.name,
    email: input.email,
    phone: input.phone,
    role: "employee",
    status: "active",
    department: input.department,
    position: input.position,
    manager: input.manager,
    verified: true,
    permissions: input.permissions,
    password: "Password@123",
  };

  mutableUsers.unshift(user);
  return sanitizeUser(user);
}

export function createManagedUser(input: {
  name: string;
  email: string;
  phone?: string;
  role?: UserRole;
  status?: AuthUser["status"];
  department?: string;
  position?: string;
  manager?: string;
  permissions?: PermissionSet;
}) {
  if (findAuthUserByEmail(input.email)) {
    throw new Error(`A user with ${input.email} already exists.`);
  }

  const role = input.role || "employee";
  const user: StoredUser = {
    id: `${role.replace(/[^a-z]/g, "")}_${crypto.randomUUID()}`,
    name: input.name,
    email: input.email,
    phone: input.phone,
    role,
    status: input.status || "active",
    department: input.department || (role === "user" ? "Candidate" : "General"),
    position: input.position || (role === "user" ? "Applicant" : "Employee"),
    manager: input.manager,
    verified: true,
    permissions: input.permissions || emptyPermissions(),
    password: "Password@123",
  };

  mutableUsers.unshift(user);
  return sanitizeUser(user);
}

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

export const demoAccounts = [
  { label: "Candidate", email: "asha.sharma@example.com", password: "Password@123", route: "/my-applications" },
  { label: "Employee", email: "employee@connectsphere.example", password: "Password@123", route: "/employee/profile" },
  { label: "HR", email: "hr@connectsphere.example", password: "Password@123", route: "/admin/dashboard" },
  { label: "Admin", email: "admin@connectsphere.example", password: "Password@123", route: "/admin/dashboard" },
  { label: "Super admin", email: "super@connectsphere.example", password: "Password@123", route: "/admin/audit-logs" },
  { label: "Unverified", email: "unverified@connectsphere.example", password: "Password@123", route: "/verify-email" },
];
