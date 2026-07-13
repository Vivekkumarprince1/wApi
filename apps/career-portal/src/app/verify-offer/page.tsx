import type { Metadata } from "next";
import { VerificationLookup } from "@/components/verification-lookup";

export const metadata: Metadata = {
  title: "Offer Verification",
  description: "Verify a ConnectSphere offer letter."
};

export default function VerifyOfferPage() {
  return (
    <div className="container-page py-8">
      <VerificationLookup kind="offer" />
    </div>
  );
}
