import type { Metadata } from "next";
import { VerificationLookup } from "@/components/verification-lookup";

export const metadata: Metadata = {
  title: "Certificate Verification",
  description: "Verify a ConnectSphere certificate."
};

export default function VerifyPage() {
  return (
    <div className="container-page py-8">
      <VerificationLookup kind="certificate" />
    </div>
  );
}
