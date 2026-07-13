import type { Metadata } from "next";
import { AdminConsole } from "@/components/admin-console";
import { getAdminDashboard } from "@/lib/career-store";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "HR Dashboard",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminDashboardPage() {
  const user = await requireUser({ from: "/admin/dashboard", adminAccess: true, permission: "canAccessDashboard" });
  const data = getAdminDashboard();
  return (
    <div className="container-page py-8">
      <AdminConsole initialTab="overview" currentUser={user} {...data} />
    </div>
  );
}
