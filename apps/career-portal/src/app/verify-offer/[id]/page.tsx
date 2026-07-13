import type { Metadata } from "next";
import { VerificationLookup } from "@/components/verification-lookup";

export const metadata: Metadata = {
  title: "Offer Verification Result",
};

export default async function VerifyOfferIdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="container-page py-8">
      <VerificationLookup kind="offer" initialId={id} />
    </div>
  );
}
