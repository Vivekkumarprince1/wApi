import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in | ConnectSphare",
  description: "Access your ConnectSphare workspace.",
  robots: { index: false, follow: false },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
