'use client';

import { FaChartBar, FaComments, FaClock, FaUserCheck, FaArrowUp, FaArrowDown, FaCalendarAlt } from 'react-icons/fa';
import { useState } from 'react';

export default function ChatAnalyticsPage(){
  const [timeRange, setTimeRange] = useState('7days');

  const stats = [
    { label: 'Total Conversations', value: '2,847', change: '+12.5%', trending: 'up', icon: FaComments, color: 'from-blue-500 to-blue-600' },
    { label: 'Avg Response Time', value: '2.3 min', change: '-8.2%', trending: 'down', icon: FaClock, color: 'from-purple-500 to-purple-600' },
    { label: 'Resolution Rate', value: '94.2%', change: '+3.1%', trending: 'up', icon: FaUserCheck, color: 'from-green-500 to-green-600' },
    { label: 'Active Chats', value: '147', change: '+5.7%', trending: 'up', icon: FaChartBar, color: 'from-orange-500 to-orange-600' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header with Gradient */}
      <div className="bg-gradient-to-r from-[#13C18D] to-[#0e8c6c] shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                <FaChartBar className="text-white text-2xl" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Chat Analytics</h1>
                <p className="text-white/90 text-sm mt-1">Track your team's performance metrics</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <select 
                value={timeRange} 
                onChange={(e) => setTimeRange(e.target.value)}
                className="px-4 py-2.5 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white font-medium focus:outline-none focus:ring-2 focus:ring-white/50"
              >
                <option value="24hours" className="text-gray-900">Last 24 Hours</option>
                <option value="7days" className="text-gray-900">Last 7 Days</option>
                <option value="30days" className="text-gray-900">Last 30 Days</option>
                <option value="custom" className="text-gray-900">Custom Range</option>
              </select>
              <button className="px-5 py-2.5 bg-white text-[#13C18D] rounded-xl font-semibold hover:shadow-xl transition-all hover:scale-105">
                <FaCalendarAlt className="inline mr-2" />Export Report
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, idx) => (
            <div key={idx} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 bg-gradient-to-br ${stat.color} rounded-xl shadow-md`}>
                  <stat.icon className="text-white text-xl" />
                </div>
                <div className={`flex items-center space-x-1 text-sm font-semibold ${
                  stat.trending === 'up' ? 'text-green-500' : 'text-red-500'
                }`}>
                  {stat.trending === 'up' ? <FaArrowUp /> : <FaArrowDown />}
                  <span>{stat.change}</span>
                </div>
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-sm font-medium mb-1">{stat.label}</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Chart Placeholder */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-8">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Conversation Trends</h3>
          <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl">
            <p className="text-gray-500 dark:text-gray-400">Chart visualization area</p>
          </div>
        </div>

        {/* Additional Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Top Performing Agents</h3>
            <div className="space-y-3">
              {['Rahul - 245 chats', 'Priya - 198 chats', 'Amit - 167 chats'].map((agent, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                  <span className="text-gray-700 dark:text-gray-200">{agent}</span>
                  <div className="w-32 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                    <div className="bg-gradient-to-r from-[#13C18D] to-[#0e8c6c] h-2 rounded-full" style={{width: `${90 - idx * 15}%`}}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Peak Hours</h3>
            <div className="h-48 flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl">
              <p className="text-gray-500 dark:text-gray-400">Peak hours chart</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
