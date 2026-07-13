import type { Metadata } from "next";
import { AdminConsole } from "@/components/admin-console";
import { getAdminDashboard } from "@/lib/career-store";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "Admin Reviews",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminReviewsPage() {
  const user = await requireUser({ from: "/admin/reviews", adminAccess: true, permission: "canManageReviews" });
  const data = getAdminDashboard();
  return (
    <div className="container-page py-8">
      <AdminConsole initialTab="people" currentUser={user} {...data} />
    </div>
  );
}
