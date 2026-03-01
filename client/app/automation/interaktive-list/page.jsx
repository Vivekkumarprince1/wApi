'use client';

import FeatureGate from '@/components/FeatureGate';
import { FaListAlt } from 'react-icons/fa';

function InteractiveListContent() {
  return (
    <div className=" p-6">
      <div className="max-w-6xl mx-auto mb-6 flex items-center gap-3">
        <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center">
          <FaListAlt className="text-white text-xl" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Interactive List</h1>
          <p className="text-sm text-muted-foreground">Configure interactive list experiences for your customers</p>
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
