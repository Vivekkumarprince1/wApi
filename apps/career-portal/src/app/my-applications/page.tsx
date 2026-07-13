import type { Metadata } from "next";
import { CandidateDashboard } from "@/components/candidate-dashboard";
import { getNotifications, listCandidateApplications, offers } from "@/lib/career-store";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "My Applications",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function MyApplicationsPage() {
  const user = await requireUser({ from: "/my-applications" });

  return (
    <div className="container-page py-8">
      <CandidateDashboard applications={listCandidateApplications(user.email)} notifications={getNotifications(user)} offers={offers} />
    </div>
  );
}
