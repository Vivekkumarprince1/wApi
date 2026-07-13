import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminConsole } from "@/components/admin-console";
import { getAdminDashboard } from "@/lib/career-store";
import { canAccessAdminArea } from "@/lib/auth-store";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function DashboardPage() {
  const user = await requireUser({ from: "/dashboard" });

  if (!canAccessAdminArea(user)) {
    redirect(user.role === "employee" ? "/employee/profile" : "/my-applications");
  }

  const data = getAdminDashboard();

  return (
    <div className="container-page py-8">
      <AdminConsole initialTab="overview" currentUser={user} {...data} />
    </div>
  );
}
