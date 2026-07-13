import type { Metadata } from "next";
import { AuthCard } from "@/components/auth-card";

export const metadata: Metadata = {
  title: "Reset Password",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <div className="container-page py-10">
      <AuthCard
        mode="reset"
        title="Reset password"
        description="Production returns generic responses, validates OTP, and rotates sessions after password changes."
        initialEmail={email}
      />
    </div>
  );
}
