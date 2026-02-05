'use client';

import FeatureGate from '@/components/FeatureGate';
import { FaAddressBook } from 'react-icons/fa';

function ContactsSettingsContent() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-3xl mx-auto mb-6 flex items-center gap-3">
        <div className="w-12 h-12 bg-emerald-600 rounded-lg flex items-center justify-center">
          <FaAddressBook className="text-white text-xl" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Contact Settings</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Control how contacts are handled</p>
        </div>
      </div>
      {/* Content will be enabled once backend API is ready */}
    </div>
  );
}

export default function ContactsSettingsPage() {
  return (
    <FeatureGate feature="contacts-settings" comingSoon>
      <ContactsSettingsContent />
    </FeatureGate>
  );
}
