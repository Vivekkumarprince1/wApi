'use client';

import { FaTasks, FaPlus, FaCalendarAlt, FaCheck, FaClock, FaUser, FaFilter } from 'react-icons/fa';
import { useState } from 'react';

export default function SalesTasksPage(){
  const [tasks] = useState([
    { id: 1, title: 'Follow up with Acme Corp', dueDate: '2025-12-30', priority: 'High', assignee: 'Rahul', status: 'Pending', relatedTo: 'Acme Corp Deal' },
    { id: 2, title: 'Send proposal to Globex', dueDate: '2025-12-29', priority: 'High', assignee: 'Priya', status: 'In Progress', relatedTo: 'Globex Intro' },
    { id: 3, title: 'Schedule demo with Initech', dueDate: '2026-01-02', priority: 'Medium', assignee: 'Amit', status: 'Pending', relatedTo: 'Initech Discovery' },
    { id: 4, title: 'Prepare pricing sheet', dueDate: '2025-12-28', priority: 'Low', assignee: 'Rahul', status: 'Completed', relatedTo: 'Soylent Pricing' },
  ]);

  const getPriorityColor = (priority) => {
    const colors = {
      'High': 'bg-red-100 text-red-700',
      'Medium': 'bg-yellow-100 text-yellow-700',
      'Low': 'bg-green-100 text-green-700',
    };
    return colors[priority] || 'bg-gray-100 text-gray-700';
  };

  const getStatusColor = (status) => {
    const colors = {
      'Pending': 'bg-gray-100 text-gray-700',
      'In Progress': 'bg-blue-100 text-blue-700',
      'Completed': 'bg-green-100 text-green-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header with Gradient */}
      <div className="bg-gradient-to-r from-[#13C18D] to-[#0e8c6c] shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                <FaTasks className="text-white text-2xl" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Sales Tasks</h1>
                <p className="text-white/90 text-sm mt-1">Manage your sales activities and follow-ups</p>
              </div>
            </div>
            <button className="flex items-center space-x-2 px-5 py-2.5 bg-white text-[#13C18D] rounded-xl font-semibold hover:shadow-xl transition-all hover:scale-105">
              <FaPlus />
              <span>Create Task</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Total Tasks</p>
            <p className="text-3xl font-bold bg-gradient-to-r from-[#13C18D] to-[#0e8c6c] bg-clip-text text-transparent">{tasks.length}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Pending</p>
            <p className="text-3xl font-bold text-gray-500">{tasks.filter(t => t.status === 'Pending').length}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">In Progress</p>
            <p className="text-3xl font-bold text-blue-500">{tasks.filter(t => t.status === 'In Progress').length}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Completed</p>
            <p className="text-3xl font-bold text-green-500">{tasks.filter(t => t.status === 'Completed').length}</p>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 mb-6">
          <div className="flex items-center space-x-3">
            <button className="px-4 py-2 bg-[#13C18D] text-white rounded-xl font-medium">
              All Tasks
            </button>
            <button className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl font-medium">
              My Tasks
            </button>
            <button className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl font-medium">
              Overdue
            </button>
            <div className="flex-1"></div>
            <button className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl">
              <FaFilter />
            </button>
          </div>
        </div>

        {/* Tasks Table */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Task</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Related To</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Assignee</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Due Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Priority</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {tasks.map((task) => (
                  <tr key={task.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{task.title}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{task.relatedTo}</td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <FaUser className="text-gray-400" />
                        <span className="text-gray-600 dark:text-gray-300">{task.assignee}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <FaCalendarAlt className="text-gray-400" />
                        <span className="text-gray-600 dark:text-gray-300">{task.dueDate}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(task.status)}`}>
                        {task.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button className="text-[#13C18D] hover:text-[#0e8c6c]" title="Mark as Complete">
                        <FaCheck />
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
