'use client';

import { useState } from 'react';
import { FaRobot, FaPlus, FaSearch, FaEllipsisV, FaWhatsapp, FaInstagram } from 'react-icons/fa';

export default function WorkflowsPage() {
  const [activeTab, setActiveTab] = useState('whatsapp');
  const [searchTerm, setSearchTerm] = useState('');

  const automations = [
    {
      trigger: 'What types of accommodati... +9',
      actionType: 'Auto replies',
      preview: 'We offer single, double rooms, flats, and host...',
      conversationsSent: 0,
      created: 'Created on 22/11/2025',
      updated: 'Updated on 22/11/2025'
    },
    {
      trigger: 'Is online booking secure? +9',
      actionType: 'Auto replies',
      preview: 'Yes, online booking ensures secure transacti...',
      conversationsSent: 0,
      created: 'Created on 22/11/2025',
      updated: 'Updated on 22/11/2025'
    },
    {
      trigger: 'How does the booking proce... +9',
      actionType: 'Auto replies',
      preview: 'Booking is easy: choose a room, pay online, ...',
      conversationsSent: 0,
      created: 'Created on 22/11/2025',
      updated: 'Updated on 22/11/2025'
    },
    {
      trigger: '--',
      actionType: 'Workflow',
      preview: 'ai_traveler_short-stay_promotions_xz',
      conversationsSent: 0,
      created: 'Created on 22/11/2025',
      updated: 'Updated on 22/11/2025'
    },
    {
      trigger: '--',
      actionType: 'Workflow',
      preview: 'ai_student_engagement_initiatives_xl',
      conversationsSent: 0,
      created: 'Created on 22/11/2025',
      updated: 'Updated on 22/11/2025'
    },
    {
      trigger: '--',
      actionType: 'Workflow',
      preview: 'ai_online_room_booking_campaign_vm',
      conversationsSent: 0,
      created: 'Created on 22/11/2025',
      updated: 'Updated on 22/11/2025'
    },
    {
      trigger: 'Shared Inbox',
      actionType: 'Auto replies',
      preview: 'You can use Interakt\'s Shared Team Inbox to ...',
      conversationsSent: 0,
      created: 'Created on 22/11/2025',
      updated: 'Updated on 22/11/2025'
    },
    {
      trigger: 'WhatsApp Campaigns',
      actionType: 'Auto replies',
      preview: 'WhatsApp Notification Campaigns are a grea...',
      conversationsSent: 0,
      created: 'Created on 22/11/2025',
      updated: 'Updated on 22/11/2025'
    },
    {
      trigger: 'Order Return Policy',
      actionType: 'Auto replies',
      preview: 'You can register a return request only within ...',
      conversationsSent: 0,
      created: 'Created on 22/11/2025',
      updated: 'Updated on 22/11/2025'
    },
    {
      trigger: 'Order Delivery Time',
      actionType: 'Auto replies',
      preview: 'We generally dispatch your order within 2 we...',
      conversationsSent: 0,
      created: 'Created on 22/11/2025',
      updated: 'Updated on 22/11/2025'
    },
    {
      trigger: 'WhatsApp Automation',
      actionType: 'Auto replies',
      preview: 'We know that your customers are reaching o...',
      conversationsSent: 0,
      created: 'Created on 22/11/2025',
      updated: 'Updated on 22/11/2025'
    },
    {
      trigger: 'WhatsApp Commerce',
      actionType: 'Auto replies',
      preview: 'Help your customers discover your product c...',
      conversationsSent: 0,
      created: 'Created on 22/11/2025',
      updated: 'Updated on 22/11/2025'
    },
    {
      trigger: 'View Products',
      actionType: 'Auto replies',
      preview: 'Click below to browse through our trending c...',
      conversationsSent: 0,
      created: 'Created on 22/11/2025',
      updated: 'Updated on 22/11/2025'
    },
    {
      trigger: 'About us',
      actionType: 'Auto replies',
      preview: 'The Apparel Store is a one-stop destination f...',
      conversationsSent: 0,
      created: 'Created on 22/11/2025',
      updated: 'Updated on 22/11/2025'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Top Banner */}
      <div className="bg-teal-500 text-white px-6 py-3 text-sm">
        Want to learn how leading Indian D2C brands are driving 40X engagement to win customers on WhatsApp?
        <button className="ml-4 bg-white text-teal-600 px-4 py-1 rounded font-medium hover:bg-gray-100 transition-colors">
          Read Now
        </button>
      </div>

      {/* Main Content */}
      <div className="p-6">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 bg-gray-800 dark:bg-gray-700 rounded-full flex items-center justify-center">
                <FaRobot className="text-white text-xl" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  My Automations
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Build workflows and auto-replies to reply to customer messages without delay
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <FaPlus className="text-gray-700 dark:text-gray-300" />
                <span className="text-gray-700 dark:text-gray-300 font-medium">New Workflow</span>
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 transition-colors font-medium">
                <FaPlus />
                Add New Custom Reply
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('whatsapp')}
              className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
                activeTab === 'whatsapp'
                  ? 'border-teal-600 text-teal-600'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <FaWhatsapp />
              <span className="font-medium">WhatsApp</span>
            </button>
            <button
              onClick={() => setActiveTab('instagram')}
              className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
                activeTab === 'instagram'
                  ? 'border-teal-600 text-teal-600'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <FaInstagram />
              <span className="font-medium">Instagram</span>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-4">
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by Trigger"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Trigger
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Action Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Action Preview
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Conversation Sent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Created/Updated
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {automations.map((automation, index) => (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                      {automation.trigger}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <span className={`w-4 h-4 rounded-full flex items-center justify-center ${
                          automation.actionType === 'Workflow' ? 'bg-purple-100 dark:bg-purple-900' : 'bg-teal-100 dark:bg-teal-900'
                        }`}>
                          {automation.actionType === 'Workflow' ? (
                            <span className="text-purple-600 dark:text-purple-400 text-xs">📊</span>
                          ) : (
                            <span className="text-teal-600 dark:text-teal-400 text-xs">↩️</span>
                          )}
                        </span>
                        <span>{automation.actionType}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {automation.preview}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white text-center">
                      {automation.conversationsSent}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-600 dark:text-gray-400">
                      <div>{automation.created}</div>
                      <div>{automation.updated}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                        <FaEllipsisV />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination or footer can be added here */}
        <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          Showing {automations.length} automations
        </div>
      </div>
    </div>
  );
}
