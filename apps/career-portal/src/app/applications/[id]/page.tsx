import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ApplicationDetail } from "@/components/application-detail";
import { getApplicationById, getApplicationOffer, getContractByApplicationId, getJobById } from "@/lib/career-store";
import { hasPermission } from "@/lib/auth-store";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "Application Detail",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser({ from: `/applications/${id}` });
  const application = getApplicationById(id);
  if (!application) notFound();

  const canManage = hasPermission(user, "canViewApplicants");
  const ownsApplication = application.candidate.email.toLowerCase() === user.email.toLowerCase();
  if (!canManage && !ownsApplication) {
    redirect(`/unauthorized?from=${encodeURIComponent(`/applications/${id}`)}`);
  }

  const offer = getApplicationOffer(application.id);
  const job = getJobById(application.jobId);
  const contract = getContractByApplicationId(application.id);

  return (
    <div className="container-page py-8">
      <ApplicationDetail
        initialApplication={application}
        job={job}
        offer={offer}
        contract={contract}
        canManage={canManage}
        canGenerateOffer={hasPermission(user, "canGenerateOfferLetter")}
      />
    </div>
  );
}
