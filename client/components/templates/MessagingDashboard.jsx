/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * MESSAGING DASHBOARD
 * 
 * Central hub for all messaging operations:
 * - Send templates
 * - Bulk messaging
 * - Conversation management
 * - Message analytics
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use client';

import React, { useState } from 'react';
import {
  FaPaperPlane,
  FaEnvelope,
  FaChartBar,
  FaHistory,
  FaUsers,
  FaClock
} from 'react-icons/fa';
import TemplateSender from './TemplateSender';

// Tab components
const SendTemplateTab = () => <TemplateSender />;

const BulkMessagingTab = () => (
  <div className="p-6">
    <h3 className="text-lg font-bold mb-4">Bulk Messaging</h3>
    <p className="text-gray-600">Upload CSV with phone numbers and template variables</p>
  </div>
);

const AnalyticsTab = () => (
  <div className="p-6">
    <h3 className="text-lg font-bold mb-4">Message Analytics</h3>
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <p className="text-sm text-gray-600">Total Sent</p>
        <p className="text-2xl font-bold text-gray-900">0</p>
      </div>
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <p className="text-sm text-gray-600">Delivered</p>
        <p className="text-2xl font-bold text-green-600">0</p>
      </div>
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <p className="text-sm text-gray-600">Read</p>
        <p className="text-2xl font-bold text-blue-600">0</p>
      </div>
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <p className="text-sm text-gray-600">Failed</p>
        <p className="text-2xl font-bold text-red-600">0</p>
      </div>
    </div>
  </div>
);

export default function MessagingDashboard() {
  const [activeTab, setActiveTab] = useState('send');

  const tabs = [
    { id: 'send', label: 'Send Template', icon: FaPaperPlane, component: SendTemplateTab },
    { id: 'bulk', label: 'Bulk Messaging', icon: FaUsers, component: BulkMessagingTab },
    { id: 'analytics', label: 'Analytics', icon: FaChartBar, component: AnalyticsTab }
  ];

  const ActiveComponent = tabs.find(t => t.id === activeTab)?.component || SendTemplateTab;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-1 px-6 py-4 overflow-x-auto">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-green-100 text-green-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="text-lg" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto">
        <ActiveComponent />
      </div>
    </div>
  );
}
