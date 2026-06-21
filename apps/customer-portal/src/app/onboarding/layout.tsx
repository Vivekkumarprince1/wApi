import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Onboarding | ConnectSphare",
  description: "Finish setting up your workspace.",
  robots: { index: false, follow: false },
};

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
