import type { Metadata } from "next";
import { AdminConsole } from "@/components/admin-console";
import { getAdminDashboard } from "@/lib/career-store";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "Audit Logs",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AuditLogsPage() {
  const user = await requireUser({ from: "/admin/audit-logs", adminAccess: true, superAdminOnly: true });
  const data = getAdminDashboard();
  return (
    <div className="container-page py-8">
      <AdminConsole initialTab="audit" currentUser={user} {...data} />
    </div>
  );
}
