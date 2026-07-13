import type { Metadata } from "next";
import { AdminRecommendationsManager } from "@/components/admin-recommendations-manager";
import { listRecommendations } from "@/lib/career-store";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "Admin Recommendations",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminRecommendationsPage() {
  await requireUser({ from: "/admin/recommendations", adminAccess: true, permission: "canManageRecommendations" });
  return (
    <div className="container-page py-8">
      <AdminRecommendationsManager recommendations={listRecommendations()} />
    </div>
  );
}
