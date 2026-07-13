import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ApplicationForm } from "@/components/application-form";
import { SectionHeader } from "@/components/ui";
import { getJobBySlug } from "@/lib/career-store";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "Apply",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ApplyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser({ from: `/apply/${slug}`, verified: true });
  const job = getJobBySlug(slug);
  if (!job) notFound();

  return (
    <div className="container-page py-8">
      <SectionHeader
        eyebrow="Application"
        title={`Apply for ${job.title}`}
        description="This flow mirrors the PRD release-one application journey: profile, private resume intent, role questions, consent, and submission receipt."
      />
      <div className="mt-5">
        <ApplicationForm job={job} currentUser={user} />
      </div>
    </div>
  );
}
