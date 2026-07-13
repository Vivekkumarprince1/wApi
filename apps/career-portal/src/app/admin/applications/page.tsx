import type { Metadata } from "next";
import { AdminConsole } from "@/components/admin-console";
import { getAdminDashboard } from "@/lib/career-store";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "Admin Applications",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminApplicationsPage() {
  const user = await requireUser({ from: "/admin/applications", adminAccess: true, permission: "canViewApplicants" });
  const data = getAdminDashboard();
  return (
    <div className="container-page py-8">
      <AdminConsole initialTab="applications" currentUser={user} {...data} />
    </div>
  );
}
