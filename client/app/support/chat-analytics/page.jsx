'use client';

import { useState } from 'react';
import { FaChartBar, FaInfoCircle, FaFilter, FaTags, FaCalendar, FaDownload } from 'react-icons/fa';

export default function ChatAnalyticsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState('Last 7 days');
  const [selectedEvents, setSelectedEvents] = useState('All');
  const [selectedTags, setSelectedTags] = useState('All');

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
        {/* Header Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-start gap-3 mb-4">
            <FaChartBar className="text-2xl text-gray-700 dark:text-gray-300 mt-1" />
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Conversation Analytics
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Find out if your customers are getting timely responses & getting their issues resolved quickly!{' '}
                <a href="#" className="text-teal-600 hover:text-teal-700 font-medium">
                  Learn More
                </a>
              </p>
              <div className="flex items-start gap-2 mt-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-3">
                <FaInfoCircle className="text-yellow-600 dark:text-yellow-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  To get meaningful insights, ensure that your team members close chats
                </p>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mt-4">
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <FaFilter className="text-gray-600 dark:text-gray-400" />
              <span className="text-gray-700 dark:text-gray-300">Events</span>
            </button>
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <FaTags className="text-gray-600 dark:text-gray-400" />
              <span className="text-gray-700 dark:text-gray-300">Tags</span>
            </button>
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <FaCalendar className="text-gray-600 dark:text-gray-400" />
              <span className="text-gray-700 dark:text-gray-300">{selectedPeriod}</span>
            </button>
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <FaDownload className="text-gray-600 dark:text-gray-400" />
              <span className="text-gray-700 dark:text-gray-300">Export data</span>
            </button>
          </div>
        </div>

        {/* Info Text */}
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          These stats are for all conversations which were initiated by customers in the selected period
        </p>

        {/* Automation Messages Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Automation Messages Sent
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Out of Office Message</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">0</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Welcome Message</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">0</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Delayed Message</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">0</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Workflow Conversations for WhatsApp</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">0</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Custom Auto Replies for WhatsApp</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">0</p>
            </div>
          </div>
        </div>

        {/* Stats Grid - Row 1 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Total Conversations */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Conversations
              </h3>
              <FaInfoCircle className="text-gray-400 dark:text-gray-500" />
            </div>
            <p className="text-4xl font-bold text-gray-900 dark:text-white">0</p>
          </div>

          {/* Responded */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Responded
              </h3>
              <FaInfoCircle className="text-gray-400 dark:text-gray-500" />
            </div>
            <p className="text-4xl font-bold text-gray-900 dark:text-white">0</p>
          </div>

          {/* Resolved */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Resolved
              </h3>
              <FaInfoCircle className="text-gray-400 dark:text-gray-500" />
            </div>
            <p className="text-4xl font-bold text-gray-900 dark:text-white mb-1">0</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              0 were closed without response
            </p>
          </div>
        </div>

        {/* Stats Grid - Row 2 with Charts */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Wait Time for 1st Agent Response */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Wait Time for 1st Agent Response
              </h3>
              <FaInfoCircle className="text-gray-400 dark:text-gray-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mb-4">--</p>
            <div className="h-32 flex items-end justify-between gap-2">
              {[0, 0, 0, 0, 0, 0, 0].map((value, index) => (
                <div key={index} className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-t" style={{ height: '20%' }}></div>
              ))}
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-2">
              Dec 02/2024
            </p>
          </div>

          {/* Average Wait Time for Agent Responses */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Average Wait Time for Agent Responses
              </h3>
              <FaInfoCircle className="text-gray-400 dark:text-gray-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mb-4">--</p>
            <div className="h-32 flex items-end justify-between gap-2">
              {[0, 0, 0, 0, 0, 0, 0].map((value, index) => (
                <div key={index} className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-t" style={{ height: '20%' }}></div>
              ))}
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-2">
              Dec 02/2024
            </p>
          </div>

          {/* Resolution Time */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Resolution Time
              </h3>
              <FaInfoCircle className="text-gray-400 dark:text-gray-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mb-4">--</p>
            <div className="h-32 flex items-end justify-between gap-2">
              {[0, 0, 0, 0, 0, 0, 0].map((value, index) => (
                <div key={index} className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-t" style={{ height: '20%' }}></div>
              ))}
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-2">
              Dec 02/2024
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
