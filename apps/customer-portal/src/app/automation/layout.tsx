import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Automation | wApi",
  description:
    "Build no-code WhatsApp workflows, answer bots, and AI intents.",
};

export default function AutomationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
