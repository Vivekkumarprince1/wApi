import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings | wApi",
  description: "Configure your workspace and team settings.",
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
