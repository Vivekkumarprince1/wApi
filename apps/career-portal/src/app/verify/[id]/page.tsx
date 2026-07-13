import type { Metadata } from "next";
import { VerificationLookup } from "@/components/verification-lookup";

export const metadata: Metadata = {
  title: "Certificate Result",
};

export default async function VerifyIdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="container-page py-8">
      <VerificationLookup kind="certificate" initialId={id} />
    </div>
  );
}
