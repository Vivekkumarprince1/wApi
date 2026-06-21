import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings | ConnectSphare",
  description: "Configure your workspace and team settings.",
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
