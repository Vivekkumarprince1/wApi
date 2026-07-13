import type { Metadata } from "next";
import { PeopleManagement } from "@/components/people-management";
import { getAdminDashboard } from "@/lib/career-store";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "Manage HR",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ManageHrPage() {
  const user = await requireUser({ from: "/admin/manage-hr", adminAccess: true, superAdminOnly: true });
  const data = getAdminDashboard();
  return (
    <div className="container-page py-8">
      <PeopleManagement mode="hr" currentUser={user} users={data.users} />
    </div>
  );
}
