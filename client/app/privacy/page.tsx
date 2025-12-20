import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | Interakt",
  description: "How Interakt collects, uses, and protects your data."
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-white text-gray-900 px-4 py-10 sm:py-14">
      <div className="max-w-4xl mx-auto space-y-10">
        <header className="space-y-2 text-center">
          <p className="text-sm font-semibold text-emerald-600">Privacy Policy</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Your privacy, protected</h1>
          <p className="text-sm text-gray-600">Last updated: 20 Dec 2025</p>
        </header>

        <section className="space-y-4 text-base leading-7">
          <p>
            This Privacy Policy explains how Interakt ("we", "us", "our") collects, uses, and protects
            information when you use our website and services, including the landing page located at
            <Link href="/" className="text-emerald-700 font-semibold hover:underline"> this page</Link>.
          </p>
          <p>
            By using our platform, you agree to the practices described here. If you do not agree, please discontinue use.
          </p>
        </section>

        <Section title="Information we collect">
          <ul className="list-disc pl-6 space-y-2">
            <li>Account details you provide (name, email) when signing up.</li>
            <li>Business identifiers required for WhatsApp onboarding (WABA ID, phone number ID, business ID).</li>
            <li>Usage data (pages visited, actions taken) to improve the service.</li>
            <li>Device and log data (IP, browser, timestamps) for security and fraud prevention.</li>
          </ul>
        </Section>

        <Section title="How we use information">
          <ul className="list-disc pl-6 space-y-2">
            <li>To create and maintain your account and workspace.</li>
            <li>To run automated WhatsApp Embedded Signup (ESB) and messaging via the Meta Cloud API.</li>
            <li>To provide support, improve features, and ensure platform security.</li>
            <li>To comply with legal obligations and enforce our terms.</li>
          </ul>
        </Section>

        <Section title="Sharing">
          <ul className="list-disc pl-6 space-y-2">
            <li>With Meta/Facebook as required to complete ESB, business verification, and messaging.</li>
            <li>With service providers (infrastructure, analytics, support) bound by confidentiality.</li>
            <li>If required by law, to protect rights, or in connection with a merger or acquisition.</li>
            <li>We do not sell personal data.</li>
          </ul>
        </Section>

        <Section title="Data retention">
          <p>
            We keep data for as long as needed to provide the service, comply with legal requirements, resolve disputes,
            and enforce agreements. You can request deletion where allowed by law.
          </p>
        </Section>

        <Section title="Security">
          <p>
            We apply administrative, technical, and physical safeguards to protect data. No method is 100% secure;
            please use strong credentials and keep tokens confidential.
          </p>
        </Section>

        <Section title="Your choices">
          <ul className="list-disc pl-6 space-y-2">
            <li>Access, update, or delete your account data by contacting us.</li>
            <li>Opt out of non-essential communications via unsubscribe links or by emailing us.</li>
            <li>Disable cookies in your browser (some features may be limited).</li>
          </ul>
        </Section>

        <Section title="International transfers">
          <p>
            Data may be processed in regions where we or our providers operate. We use appropriate safeguards for cross-border transfers where required.
          </p>
        </Section>

        <Section title="Children">
          <p>
            Our services are not directed to children under 16. We do not knowingly collect data from children. If you believe a child has provided data, contact us to remove it.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            We may update this Privacy Policy. Material changes will be posted here with an updated date. Continued use constitutes acceptance of the revised Policy.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions or requests: <a className="text-emerald-700 font-semibold hover:underline" href="mailto:vivekkumarprince1@gmail.com">vivekkumarprince1@gmail.com</a>
          </p>
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      <div className="text-gray-700 leading-7 space-y-2">{children}</div>
    </section>
  );
}
