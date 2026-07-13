import type { Metadata } from "next";
import { AuthCard } from "@/components/auth-card";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "Verify Email",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; from?: string }>;
}) {
  const { email, from } = await searchParams;
  const user = await requireUser({ from: "/verify-email", verified: false });

  return (
    <div className="container-page py-10">
      <AuthCard
        mode="verify"
        title="Verify your email"
        description="OTP challenges expire after ten minutes and can be resent after cooldown."
        initialEmail={email || user.email}
        from={from}
      />
    </div>
  );
}
