import Link from 'next/link';

export const metadata = {
  title: 'Data Deletion Instructions',
  description: 'How to request data deletion for your account.'
};

export default function DataDeletionInstructions() {
  return (
    <main className="min-h-screen bg-white text-gray-900 px-4 py-14">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Data Deletion Instructions</h1>
        <p>
          If you would like to permanently delete your account and all associated data, you can request deletion by:
        </p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>Logging into your account and visiting <Link href="/dashboard/settings/account" className="text-emerald-700 font-semibold">Account Settings</Link> to use the "Delete Account" button.</li>
          <li>Or emailing our support team at <a href="mailto:vivekkumarprince1@gmail.com" className="text-emerald-700 font-semibold">vivekkumarprince1@gmail.com</a> with the subject "Data deletion request" and include your account email.</li>
        </ol>

        <p>
          Once a valid deletion request is received and verified, we will permanently remove your account, workspace, and all related data within 30 days and confirm by email.
        </p>

        <p>
          For automated deletion callbacks (used by platform verifiers), our callback endpoint is available at <code>/api/v1/privacy/data-deletion-callback</code>.
        </p>
      </div>
    </main>
  );
}
