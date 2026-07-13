import type { Metadata } from "next";
import { CredentialsManagement } from "@/components/credentials-management";
import { getAdminDashboard } from "@/lib/career-store";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "Offer Letters",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function OfferLettersPage() {
  const user = await requireUser({
    from: "/offer-letters",
    adminAccess: true,
    anyPermission: ["canGenerateCertificate", "canGenerateOfferLetter"],
  });
  const data = getAdminDashboard();

  return (
    <div className="container-page py-8">
      <CredentialsManagement
        initialTab="offers"
        initialCertificates={data.certificates}
        initialOffers={data.offers}
        applications={data.applications}
        currentUser={{ name: user.name, email: user.email }}
      />
    </div>
  );
}
