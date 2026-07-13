import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JobEditor } from "@/components/job-editor";
import { SectionHeader } from "@/components/ui";
import { getJobById, listApplications } from "@/lib/career-store";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "Edit Job",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function EditJobPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const user = await requireUser({ from: `/jobs/edit/${id}`, adminAccess: true, permission: "canCreateJob" });
  const job = getJobById(id);
  if (!job) notFound();
  const canViewApplications = user.permissions.canViewApplicants;

  return (
    <div className="container-page py-8">
      <SectionHeader
        eyebrow="Role setup"
        title={`Edit ${job.title}`}
        description="Update the public posting, publish state, and screening question set."
      />
      <div className="mt-5">
        <JobEditor
          job={job}
          initialApplications={canViewApplications ? listApplications({ jobId: job.id }) : []}
          canViewApplications={canViewApplications}
          initialTab={query?.tab === "applications" ? "applications" : query?.tab === "questions" ? "questions" : "details"}
        />
      </div>
    </div>
  );
}
