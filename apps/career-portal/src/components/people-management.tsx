"use client";

import { useMemo, useState } from "react";
import { Download, Plus, ShieldCheck, Trash2, UserRoundCog } from "lucide-react";
import type { AccountStatus, AuthUser, PermissionFlag, PermissionSet, UserRole } from "@/types/career";
import { Badge, Button, Field, Input, Select, Surface } from "@/components/ui";
import { canAccessAdminArea, hasPermission, isSuperAdminUser, roleLabel } from "@/lib/auth-client";

type PeopleMode = "users" | "employees" | "hr";

const accountStatuses: AccountStatus[] = ["active", "inactive", "former", "suspended"];
const roles: UserRole[] = ["user", "employee", "admin", "super-admin"];
const permissionFlags: PermissionFlag[] = [
  "canAccessDashboard",
  "canCreateJob",
  "canViewApplicants",
  "canGenerateCertificate",
  "canGenerateOfferLetter",
  "canManageReviews",
  "canManageEmployees",
  "canManageRecommendations",
];

const permissionLabels: Record<PermissionFlag, string> = {
  canAccessDashboard: "Dashboard",
  canCreateJob: "Jobs",
  canViewApplicants: "Applicants",
  canGenerateCertificate: "Certificates",
  canGenerateOfferLetter: "Offers",
  canManageReviews: "Reviews",
  canManageEmployees: "Employees",
  canManageRecommendations: "Referrals",
};

const defaultHrPermissions: PermissionSet = {
  canAccessDashboard: true,
  canCreateJob: false,
  canViewApplicants: true,
  canGenerateCertificate: false,
  canGenerateOfferLetter: false,
  canManageReviews: false,
  canManageEmployees: false,
  canManageRecommendations: false,
};

export function PeopleManagement({
  mode,
  currentUser,
  users,
}: {
  mode: PeopleMode;
  currentUser: AuthUser;
  users: AuthUser[];
}) {
  const [items, setItems] = useState(users);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<AccountStatus | "all">("all");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [hrForm, setHrForm] = useState({
    name: "",
    email: "",
    phone: "",
    department: "HR",
    position: "People Operations",
    manager: currentUser.name,
  });
  const [hrPermissions, setHrPermissions] = useState<PermissionSet>(defaultHrPermissions);

  const superAdmin = isSuperAdminUser(currentUser);
  const canManageEmployees = hasPermission(currentUser, "canManageEmployees");

  const visibleUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((user) => {
        if (mode === "users") return user.role === "user";
        if (mode === "employees") return user.role !== "user";
        return canAccessAdminArea(user);
      })
      .filter((user) => status === "all" || user.status === status)
      .filter((user) => {
        const haystack = [user.name, user.email, user.phone, user.role, user.status, user.department, user.position].join(" ").toLowerCase();
        return !q || haystack.includes(q);
      });
  }, [items, mode, query, status]);

  const patchUser = async (id: string, patch: Partial<Pick<AuthUser, "status" | "role" | "department" | "position" | "manager" | "permissions">>) => {
    setError("");
    setNotice("");
    const response = await fetch(`/api/v1/admin/users/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setError(payload?.error?.message || "Could not update user.");
      return;
    }
    setItems((current) => current.map((user) => (user.id === id ? payload.data : user)));
    setNotice("User updated.");
  };

  const deleteUser = async (id: string) => {
    setError("");
    setNotice("");
    const response = await fetch(`/api/v1/admin/users/${id}`, { method: "DELETE" });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setError(payload?.error?.message || "Could not delete user.");
      return;
    }
    setItems((current) => current.filter((user) => user.id !== id));
    setNotice("User deleted.");
  };

  const createHr = async () => {
    setError("");
    setNotice("");
    const response = await fetch("/api/v1/admin/users/hr", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...hrForm, permissions: hrPermissions }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setError(payload?.error?.message || "Could not create HR user.");
      return;
    }
    setItems((current) => [payload.data, ...current]);
    setHrForm({ name: "", email: "", phone: "", department: "HR", position: "People Operations", manager: currentUser.name });
    setHrPermissions(defaultHrPermissions);
    setNotice("HR user created with the shared demo password.");
  };

  const exportRows = () => {
    const header = ["name", "email", "phone", "role", "status", "department", "position", "manager"];
    const rows = visibleUsers.map((user) => [
      user.name,
      user.email,
      user.phone || "",
      user.role,
      user.status,
      user.department || "",
      user.position || "",
      user.manager || "",
    ]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `career-${mode}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const title = mode === "users" ? "Candidate users" : mode === "employees" ? "Employees and admins" : "HR authority";
  const description =
    mode === "users"
      ? "Search candidate accounts, review account status, and remove test users with super-admin authority."
      : mode === "employees"
        ? "Manage staff account status and export a staff snapshot for HR operations."
        : "Create HR users, assign permissions, and revoke elevated accounts.";

  return (
    <div className="space-y-4">
      <Surface className="p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{mode === "hr" ? "Super admin" : "People ops"}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
          </div>
          <Button type="button" variant="outline" onClick={exportRows}>
            <Download className="size-4" aria-hidden="true" />
            Export CSV
          </Button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_180px]">
          <Field id="people-search" label="Search">
            <Input id="people-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, email, department" />
          </Field>
          <Field id="people-status" label="Status">
            <Select id="people-status" value={status} onChange={(event) => setStatus(event.target.value as AccountStatus | "all")}>
              <option value="all">All statuses</option>
              {accountStatuses.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {notice ? <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p> : null}
        {error ? <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p> : null}
      </Surface>

      {mode === "hr" ? (
        <Surface className="p-4">
          <div className="flex items-start gap-3">
            <UserRoundCog className="mt-1 size-5 text-primary" aria-hidden="true" />
            <div>
              <h2 className="text-base font-semibold">Create HR account</h2>
              <p className="text-sm text-muted-foreground">New HR users are verified immediately and use `Password@123` in local development.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <Field id="hr-name" label="Name">
              <Input id="hr-name" value={hrForm.name} onChange={(event) => setHrForm((current) => ({ ...current, name: event.target.value }))} />
            </Field>
            <Field id="hr-email" label="Email">
              <Input id="hr-email" type="email" value={hrForm.email} onChange={(event) => setHrForm((current) => ({ ...current, email: event.target.value }))} />
            </Field>
            <Field id="hr-phone" label="Phone">
              <Input id="hr-phone" value={hrForm.phone} onChange={(event) => setHrForm((current) => ({ ...current, phone: event.target.value }))} />
            </Field>
            <Field id="hr-department" label="Department">
              <Input id="hr-department" value={hrForm.department} onChange={(event) => setHrForm((current) => ({ ...current, department: event.target.value }))} />
            </Field>
            <Field id="hr-position" label="Position">
              <Input id="hr-position" value={hrForm.position} onChange={(event) => setHrForm((current) => ({ ...current, position: event.target.value }))} />
            </Field>
            <Field id="hr-manager" label="Manager">
              <Input id="hr-manager" value={hrForm.manager} onChange={(event) => setHrForm((current) => ({ ...current, manager: event.target.value }))} />
            </Field>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {permissionFlags.map((permission) => (
              <label key={permission} className="flex items-center justify-between gap-3 rounded-md border bg-background p-3 text-sm">
                <span>{permissionLabels[permission]}</span>
                <input
                  type="checkbox"
                  checked={hrPermissions[permission]}
                  onChange={(event) => setHrPermissions((current) => ({ ...current, [permission]: event.target.checked }))}
                />
              </label>
            ))}
          </div>
          <Button className="mt-4" type="button" onClick={createHr} disabled={!superAdmin}>
            <Plus className="size-4" aria-hidden="true" />
            Create HR
          </Button>
        </Surface>
      ) : null}

      <Surface className="overflow-hidden">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-muted text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">User</th>
                <th className="px-3 py-2 font-medium">Role</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Department</th>
                <th className="px-3 py-2 font-medium">Permissions</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map((user) => (
                <tr key={user.id} className="border-t hover:bg-muted/40">
                  <td className="px-3 py-3">
                    <div className="font-medium">{user.name}</div>
                    <div className="text-xs text-muted-foreground">{user.email}</div>
                  </td>
                  <td className="px-3 py-3">
                    {superAdmin ? (
                      <Select value={user.role} onChange={(event) => patchUser(user.id, { role: event.target.value as UserRole })}>
                        {roles.map((role) => (
                          <option key={role} value={role}>
                            {roleLabel(role)}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      roleLabel(user.role)
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <Select value={user.status} disabled={!canManageEmployees} onChange={(event) => patchUser(user.id, { status: event.target.value as AccountStatus })}>
                      {accountStatuses.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-3 py-3">
                    <div>{user.department || "Not assigned"}</div>
                    <div className="text-xs text-muted-foreground">{user.position || "No position"}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {permissionFlags.filter((permission) => user.permissions[permission]).slice(0, 3).map((permission) => (
                        <Badge key={permission} className="bg-muted">{permissionLabels[permission]}</Badge>
                      ))}
                      {permissionFlags.filter((permission) => user.permissions[permission]).length > 3 ? <Badge className="bg-muted">More</Badge> : null}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      {mode === "hr" && superAdmin ? (
                        <Button type="button" size="sm" variant="outline" onClick={() => patchUser(user.id, { permissions: { ...user.permissions, canAccessDashboard: !user.permissions.canAccessDashboard } })}>
                          <ShieldCheck className="size-4" aria-hidden="true" />
                          Dashboard
                        </Button>
                      ) : null}
                      <Button type="button" size="sm" variant="outline" disabled={!superAdmin || user.id === currentUser.id} onClick={() => deleteUser(user.id)}>
                        <Trash2 className="size-4" aria-hidden="true" />
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 p-3 md:hidden">
          {visibleUsers.map((user) => (
            <article key={user.id} className="rounded-md border bg-background p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-medium">{user.name}</h2>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <Badge className="bg-muted">{user.status}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{roleLabel(user.role)} · {user.department || "Not assigned"}</p>
              <div className="mt-3 grid gap-2">
                <Select value={user.status} disabled={!canManageEmployees} onChange={(event) => patchUser(user.id, { status: event.target.value as AccountStatus })}>
                  {accountStatuses.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </Select>
                <Button type="button" size="sm" variant="outline" disabled={!superAdmin || user.id === currentUser.id} onClick={() => deleteUser(user.id)}>
                  <Trash2 className="size-4" aria-hidden="true" />
                  Delete
                </Button>
              </div>
            </article>
          ))}
        </div>
      </Surface>
    </div>
  );
}
