import type { Metadata } from "next";
import { JobDirectory } from "@/components/job-directory";
import { SectionHeader } from "@/components/ui";
import { listJobs } from "@/lib/career-store";

export const metadata: Metadata = {
  title: "Open Roles",
  description: "Search and filter active ConnectSphere roles."
};

export default function JobsPage() {
  return (
    <div className="container-page py-8">
      <SectionHeader
        eyebrow="Jobs"
        title="Open ConnectSphere roles"
        description="Search by team, work mode, location, or skill. URL-backed filtering can be layered on this client interaction when persistence is connected."
      />
      <div className="mt-5">
        <JobDirectory jobs={listJobs()} />
      </div>
    </div>
  );
}
