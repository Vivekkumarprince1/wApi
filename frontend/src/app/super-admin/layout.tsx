import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Super Admin | wApi",
  description:
    "Internal control plane: workspaces, users, infrastructure, compliance.",
  robots: { index: false, follow: false },
};

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
