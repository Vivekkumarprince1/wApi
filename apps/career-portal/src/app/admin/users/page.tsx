import type { Metadata } from "next";
import { PeopleManagement } from "@/components/people-management";
import { getAdminDashboard } from "@/lib/career-store";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "Admin Users",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminUsersPage() {
  const user = await requireUser({ from: "/admin/users", adminAccess: true, permission: "canManageEmployees" });
  const data = getAdminDashboard();
  return (
    <div className="container-page py-8">
      <PeopleManagement mode="users" currentUser={user} users={data.users} />
    </div>
  );
}
