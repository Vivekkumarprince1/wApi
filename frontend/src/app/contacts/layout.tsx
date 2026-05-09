import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contacts | wApi",
  description: "Manage your contact lists, segments, and imports.",
};

export default function ContactsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
