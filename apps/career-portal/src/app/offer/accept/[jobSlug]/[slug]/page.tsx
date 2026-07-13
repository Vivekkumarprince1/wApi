import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OfferAcceptance } from "@/components/offer-acceptance";
import { getOfferForAcceptance } from "@/lib/career-store";

export const metadata: Metadata = {
  title: "Accept Offer",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function OfferAcceptPage({ params }: { params: Promise<{ jobSlug: string; slug: string }> }) {
  const { slug } = await params;
  const data = getAcceptanceData(slug);
  if (!data) notFound();

  return <OfferAcceptance offer={data.offer} initialContract={data.contract} />;
}

function getAcceptanceData(slug: string) {
  try {
    return getOfferForAcceptance(slug);
  } catch {
    return null;
  }
}
