import type { Metadata } from "next";
import { NotificationsPanel } from "@/components/notifications-panel";
import { SectionHeader } from "@/components/ui";
import { getNotifications } from "@/lib/career-store";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "Notifications",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function NotificationsPage() {
  const user = await requireUser({ from: "/notifications" });
  const notifications = getNotifications(user);

  return (
    <div className="container-page py-8">
      <SectionHeader
        eyebrow="Candidate"
        title="Notifications"
        description="Application-status, job-update, and system notifications with read/delete controls represented for the PRD workflow."
      />
      <div className="mt-5">
        <NotificationsPanel initialNotifications={notifications} />
      </div>
    </div>
  );
}
