import type { Metadata } from "next";
import { Mail, MapPin, Phone } from "lucide-react";
import { ContactForm } from "@/components/contact-form";
import { SectionHeader, Surface } from "@/components/ui";

export const metadata: Metadata = {
  title: "Contact HR",
  description: "Contact the ConnectSphere careers team."
};

export default function ContactPage() {
  return (
    <div className="container-page grid gap-6 py-8 lg:grid-cols-[1fr_360px]">
      <div>
        <SectionHeader
          eyebrow="Contact"
          title="Reach the careers team"
          description="Use this for hiring questions, accessibility requests, verification issues, and application support."
        />
        <div className="mt-5">
          <ContactForm />
        </div>
      </div>
      <aside className="space-y-4">
        <Surface className="p-4">
          <h2 className="text-base font-semibold">Support inbox</h2>
          <div className="mt-3 grid gap-3 text-sm text-muted-foreground">
            <p><Mail className="mr-2 inline size-4 text-primary" aria-hidden="true" /> careers@connectsphere.example</p>
            <p><Phone className="mr-2 inline size-4 text-primary" aria-hidden="true" /> +91 98765 43210</p>
            <p><MapPin className="mr-2 inline size-4 text-primary" aria-hidden="true" /> India hiring operations</p>
          </div>
        </Surface>
      </aside>
    </div>
  );
}
