import Link from "next/link";

export const metadata = {
  title: `Privacy Policy | ${process.env.NEXT_PUBLIC_APP_NAME || 'Interakt'}`,
  description: `How ${process.env.NEXT_PUBLIC_APP_NAME || 'Interakt'} collects, uses, and protects your data.`
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-white text-gray-900 px-4 py-10 sm:py-14">
      <div className="max-w-4xl mx-auto space-y-10">
        <header className="space-y-2 text-center">
          <p className="text-sm font-semibold text-emerald-600">Privacy Policy</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Your privacy, protected</h1>
          <p className="text-sm text-gray-600">Last updated: 30 Dec 2025</p>
        </header>

        <section className="space-y-4 text-base leading-7">
          <p>
            This Privacy Policy explains how {process.env.NEXT_PUBLIC_APP_NAME || 'Interakt'} ("we", "us", "our") collects, uses, and protects
            information when you use our website and services, including the landing page located at
            <Link href="/" className="text-emerald-700 font-semibold hover:underline"> this page</Link>.
          </p>
          <p>
            By using our platform, you agree to the practices described here. If you do not agree, please discontinue use.
          </p>
        </section>

        <Section title="Information we collect">
          <ul className="list-disc pl-6 space-y-2">
            <li>Account details you provide (name, email, phone number) when signing up.</li>
            <li>Business identifiers required for WhatsApp onboarding (WABA ID, phone number ID, business ID, access tokens).</li>
            <li>Message data (content, timestamps, sender/receiver information) processed for automation, campaigns, and service delivery.</li>
            <li>Commerce data (product details, orders, payment information) for checkout and order management features.</li>
            <li>Contact data (names, phone numbers, interaction history) uploaded or synced for messaging and CRM purposes.</li>
            <li>Usage data (pages visited, actions taken, feature usage) to improve the service and analytics.</li>
            <li>Device and log data (IP address, browser type, device info, timestamps) for security, fraud prevention, and troubleshooting.</li>
          </ul>
        </Section>

        <Section title="How we use information">
          <ul className="list-disc pl-6 space-y-2">
            <li>To create and maintain your account and workspace.</li>
            <li>To run automated WhatsApp Embedded Signup (ESB), messaging, campaigns, and workflows via the Meta Cloud API.</li>
            <li>To process and manage commerce transactions, orders, and product catalogs.</li>
            <li>To provide customer support, improve features, personalize experiences, and ensure platform security.</li>
            <li>To analyze usage patterns, generate reports, and comply with legal obligations.</li>
            <li>To send service-related notifications, updates, and marketing communications (with opt-out options).</li>
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

        <Section title="Cookies and Tracking">
          <p>
            We use cookies, web beacons, and similar technologies to enhance your experience, analyze usage, and provide personalized content.
            You can manage cookie preferences through your browser settings, though this may affect functionality.
          </p>
        </Section>

        <Section title="Your choices">
          <ul className="list-disc pl-6 space-y-2">
            <li>Access, update, or delete your account data by contacting us or using account settings.</li>
            <li>Opt out of non-essential communications via unsubscribe links or by emailing us.</li>
            <li>Manage cookies in your browser (some features may be limited).</li>
            <li>Request data portability or restriction of processing where legally required.</li>
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

        <Section title="Third-Party Services">
          <p>
            Our platform integrates with third-party services like Meta for WhatsApp, payment gateways for commerce, and analytics providers.
            These services have their own privacy policies, and we encourage you to review them.
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
