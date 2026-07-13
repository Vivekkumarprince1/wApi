import type { Metadata } from "next";
import { AuthCard } from "@/components/auth-card";

export const metadata: Metadata = {
  title: "Register",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;

  return (
    <div className="container-page py-10">
      <AuthCard
        mode="register"
        title="Create a candidate account"
        description="The production flow verifies email by OTP before login and prevents duplicate addresses server-side."
        from={from}
      />
    </div>
  );
}
