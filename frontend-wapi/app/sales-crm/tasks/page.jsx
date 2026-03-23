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
      'High': 'bg-destructive/10 text-destructive',
      'Medium': 'bg-amber-500/10 text-amber-600',
      'Low': 'bg-emerald-500/10 text-emerald-600',
    };
    return colors[priority] || 'bg-muted text-muted-foreground';
  };

  const getStatusColor = (status) => {
    const colors = {
      'Pending': 'bg-muted text-muted-foreground',
      'In Progress': 'bg-blue-100 text-blue-700',
      'Completed': 'bg-emerald-500/10 text-emerald-600',
    };
    return colors[status] || 'bg-muted text-muted-foreground';
  };

  return (
    <div className="">
      {/* Header with Gradient */}
      <div className="bg-gradient-to-r from-primary to-primary/80 shadow-premium">
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
            <button className="flex items-center space-x-2 px-5 py-2.5 bg-white text-primary rounded-xl font-semibold hover:shadow-xl transition-all hover:scale-105">
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
          <div className="bg-card rounded-2xl shadow-premium p-6">
            <p className="text-muted-foreground text-sm mb-1">Total Tasks</p>
            <p className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">{tasks.length}</p>
          </div>
          <div className="bg-card rounded-2xl shadow-premium p-6">
            <p className="text-muted-foreground text-sm mb-1">Pending</p>
            <p className="text-3xl font-bold text-muted-foreground">{tasks.filter(t => t.status === 'Pending').length}</p>
          </div>
          <div className="bg-card rounded-2xl shadow-premium p-6">
            <p className="text-muted-foreground text-sm mb-1">In Progress</p>
            <p className="text-3xl font-bold text-blue-500">{tasks.filter(t => t.status === 'In Progress').length}</p>
          </div>
          <div className="bg-card rounded-2xl shadow-premium p-6">
            <p className="text-muted-foreground text-sm mb-1">Completed</p>
            <p className="text-3xl font-bold text-green-500">{tasks.filter(t => t.status === 'Completed').length}</p>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-card rounded-2xl shadow-premium p-4 mb-6">
          <div className="flex items-center space-x-3">
            <button className="px-4 py-2 bg-primary text-white rounded-xl font-medium">
              All Tasks
            </button>
            <button className="px-4 py-2 text-foreground hover:bg-accent rounded-xl font-medium">
              My Tasks
            </button>
            <button className="px-4 py-2 text-foreground hover:bg-accent rounded-xl font-medium">
              Overdue
            </button>
            <div className="flex-1"></div>
            <button className="p-2 text-muted-foreground hover:bg-accent rounded-xl">
              <FaFilter />
            </button>
          </div>
        </div>

        {/* Tasks Table */}
        <div className="bg-card rounded-2xl shadow-premium overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Task</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Related To</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Assignee</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Due Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Priority</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tasks.map((task) => (
                  <tr key={task.id} className="hover:bg-accent transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-foreground">{task.title}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{task.relatedTo}</td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <FaUser className="text-muted-foreground" />
                        <span className="text-muted-foreground">{task.assignee}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <FaCalendarAlt className="text-muted-foreground" />
                        <span className="text-muted-foreground">{task.dueDate}</span>
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
                      <button className="text-primary hover:text-primary/80" title="Mark as Complete">
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
