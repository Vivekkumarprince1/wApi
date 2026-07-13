import type { Metadata } from "next";
import { JobEditor } from "@/components/job-editor";
import { SectionHeader } from "@/components/ui";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "Create Job",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function CreateJobPage() {
  await requireUser({ from: "/jobs/create", adminAccess: true, permission: "canCreateJob" });

  return (
    <div className="container-page py-8">
      <SectionHeader
        eyebrow="Role setup"
        title="Create job posting"
        description="Publish an opening with responsibilities, requirements, and role-specific screening questions."
      />
      <div className="mt-5">
        <JobEditor />
      </div>
    </div>
  );
}
