'use client';

import React, { useState } from 'react';
import ContactsSection from '@/components/shared/ContactsSection';
import SegmentBuilder from '@/components/dashboard/contacts/SegmentBuilder';
import { Users, Filter } from 'lucide-react';

export default function ContactsPage() {
  const [activeTab, setActiveTab] = useState('all');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-6 border-b border-border">
        <button 
          onClick={() => setActiveTab('all')}
          className={`pb-4 text-sm font-bold flex items-center gap-2 transition-all border-b-2 ${activeTab === 'all' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <Users className="h-4 w-4" /> All Contacts
        </button>
        <button 
          onClick={() => setActiveTab('segments')}
          className={`pb-4 text-sm font-bold flex items-center gap-2 transition-all border-b-2 ${activeTab === 'segments' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <Filter className="h-4 w-4" /> Dynamic Segments
        </button>
      </div>

      <div className="animate-fade-in">
        {activeTab === 'all' ? <ContactsSection /> : <SegmentBuilder />}
      </div>
    </div>
  );
}
