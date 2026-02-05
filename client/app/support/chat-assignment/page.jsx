'use client';

import { FaUserPlus, FaUsers, FaRobot, FaCog, FaPlus, FaEdit, FaTrash } from 'react-icons/fa';
import { useState } from 'react';

export default function ChatAssignmentPage(){
  const [assignmentRules, setAssignmentRules] = useState([
    { id: 1, name: 'VIP Customers', type: 'Tag-based', assignTo: 'Senior Team', priority: 'High', active: true },
    { id: 2, name: 'New Leads', type: 'Round Robin', assignTo: 'All Agents', priority: 'Medium', active: true },
    { id: 3, name: 'Technical Support', type: 'Skill-based', assignTo: 'Tech Team', priority: 'High', active: false },
  ]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header with Gradient */}
      <div className="bg-gradient-to-r from-[#13C18D] to-[#0e8c6c] shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                <FaUserPlus className="text-white text-2xl" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Chat Assignment</h1>
                <p className="text-white/90 text-sm mt-1">Configure automatic chat routing rules</p>
              </div>
            </div>
            <button className="flex items-center space-x-2 px-5 py-2.5 bg-white text-[#13C18D] rounded-xl font-semibold hover:shadow-xl transition-all hover:scale-105">
              <FaPlus />
              <span>Create Rule</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl">
                <FaUsers className="text-white text-xl" />
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Active Agents</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">24</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl">
                <FaRobot className="text-white text-xl" />
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Assignment Rules</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{assignmentRules.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-xl">
                <FaCog className="text-white text-xl" />
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Auto-Assigned Today</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">156</p>
              </div>
            </div>
          </div>
        </div>

        {/* Assignment Rules Table */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Assignment Rules</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Rule Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Assign To</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Priority</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {assignmentRules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{rule.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{rule.type}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{rule.assignTo}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        rule.priority === 'High' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>{rule.priority}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        rule.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}>{rule.active ? 'Active' : 'Inactive'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button className="text-[#13C18D] hover:text-[#0e8c6c] mr-3">
                        <FaEdit />
                      </button>
                      <button className="text-red-500 hover:text-red-700">
                        <FaTrash />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
