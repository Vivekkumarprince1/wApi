import type { Metadata } from "next";
import { AuthCard } from "@/components/auth-card";

export const metadata: Metadata = {
  title: "Login",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const showDevCredentials =
    process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_SHOW_DEV_CREDENTIALS === "true";

  return (
    <div className="container-page py-10">
      <AuthCard
        mode="login"
        title="Sign in to careers"
        description="Session handling is represented here for the PRD; production uses a 24-hour HttpOnly secure cookie."
        from={from}
        showDevCredentials={showDevCredentials}
      />
    </div>
  );
}
