'use client';

import FeatureGate from '@/components/FeatureGate';
import { FaListAlt } from 'react-icons/fa';

function InteractiveListContent() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto mb-6 flex items-center gap-3">
        <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
          <FaListAlt className="text-white text-xl" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Interactive List</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Configure interactive list experiences for your customers</p>
        </div>
      </div>
      {/* Content will be enabled once backend API is ready */}
    </div>
  );
}

export default function InteractiveListPage() {
  return (
    <FeatureGate feature="interactives" comingSoon>
      <InteractiveListContent />
    </FeatureGate>
  );
}
