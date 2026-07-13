import type { Metadata } from "next";
import { CredentialsManagement } from "@/components/credentials-management";
import { getAdminDashboard } from "@/lib/career-store";
import { requireUser } from "@/lib/server-auth";
import type { AuthUser } from "@/types/career";

export const metadata: Metadata = {
  title: "Certificates",
  robots: {
    index: false,
    follow: false,
  },
};

type SearchParams = {
  tab?: string;
  action?: string;
  email?: string;
  name?: string;
  domain?: string;
  jobrole?: string;
  fromDate?: string;
  toDate?: string;
};

function mapTab(tab?: string) {
  if (tab === "issue") return "issue-certificate";
  if (tab === "offer") return "issue-offer";
  if (tab === "all") return "certificates";
  if (tab === "alloffers") return "offers";
  if (tab === "verify") return "verify";
  return "issue-certificate";
}

export default async function CertificatesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const query = await searchParams;
  const user: AuthUser = await requireUser({
    from: "/certificates",
    adminAccess: true,
    anyPermission: ["canGenerateCertificate", "canGenerateOfferLetter"],
  });
  const data = getAdminDashboard();

  return (
    <div className="container-page py-8">
      <CredentialsManagement
        initialTab={mapTab(query.tab)}
        initialCertificates={data.certificates}
        initialOffers={data.offers}
        applications={data.applications}
        certificatePrefill={{
          recipientName: query.name || "",
          recipientEmail: query.email || "",
          credential: query.domain || "Internship Completion",
          role: query.jobrole || "",
          fromDate: query.fromDate || "",
          toDate: query.toDate || "",
        }}
        filterEmail={query.tab === "alloffers" ? query.email || "" : ""}
        autoOpenExtendEmail={query.action === "extend" ? query.email || "" : ""}
        currentUser={{ name: user.name, email: user.email }}
      />
    </div>
  );
}
