import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OfferAcceptance } from "@/components/offer-acceptance";
import { getOfferForAcceptance } from "@/lib/career-store";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "Offer and Onboarding",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ContractPage({ params }: { params: Promise<{ offerId: string }> }) {
  const { offerId } = await params;
  await requireUser({ from: `/contract/${offerId}` });
  const data = getAcceptanceData(offerId);
  if (!data) notFound();

  return <OfferAcceptance offer={data.offer} initialContract={data.contract} />;
}

function getAcceptanceData(offerId: string) {
  try {
    return getOfferForAcceptance(offerId);
  } catch {
    return null;
  }
}
