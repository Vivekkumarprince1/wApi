'use client';

import FeatureGate from '@/components/FeatureGate';
import { FaShieldAlt } from 'react-icons/fa';

function RolesContent() {
  return (
    <div className=" p-6">
      <div className="max-w-6xl mx-auto mb-6 flex items-center gap-3">
        <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center">
          <FaShieldAlt className="text-white text-xl" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Roles & Permissions</h1>
          <p className="text-sm text-muted-foreground">Define what your team can access</p>
        </div>
      </div>
      {/* Content will be enabled once backend API is ready */}
    </div>
  );
}

export default function RolesSettingsPage() {
  return (
    <FeatureGate feature="roles" comingSoon>
      <RolesContent />
    </FeatureGate>
  );
}
