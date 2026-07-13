import type { Metadata } from "next";
import { CredentialsManagement } from "@/components/credentials-management";
import { getAdminDashboard } from "@/lib/career-store";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "Admin Certificates",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminCertificatesPage() {
  const user = await requireUser({
    from: "/admin/certificates",
    adminAccess: true,
    anyPermission: ["canGenerateCertificate", "canGenerateOfferLetter"],
  });
  const data = getAdminDashboard();
  return (
    <div className="container-page py-8">
      <CredentialsManagement
        initialTab="certificates"
        initialCertificates={data.certificates}
        initialOffers={data.offers}
        applications={data.applications}
        currentUser={{ name: user.name, email: user.email }}
      />
    </div>
  );
}
