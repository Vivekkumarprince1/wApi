'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/axios';
import { 
  FaChartBar, FaClock, FaCheckCircle, FaUsers, FaCalendarAlt, 
  FaFilter, FaArrowLeft, FaDownload, FaSpinner, FaInbox
} from 'react-icons/fa';
import Link from 'next/link';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, Legend, Cell, PieChart, Pie
} from 'recharts';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

// API_BASE removed in favor of global api client configuration

export default function InboxAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [dateRange, setDateRange] = useState('7d'); // 7d, 30d, 90d
  const [team, setTeam] = useState('all');

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange, team]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await api.get('/inbox/analytics/report', {
        params: { range: dateRange, team }
      });
      // the api client returns response.data directly
      setData(response.data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      toast.error('Failed to load inbox analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <FaSpinner className="animate-spin text-4xl text-[#00a884]" />
        <p className="text-gray-500 font-medium">Crunching your inbox data...</p>
      </div>
    );
  }

  const COLORS = ['#00a884', '#00c39a', '#25d366', '#1ebea5', '#075e54'];

  return (
    <div className="max-w-[1400px] mx-auto p-6 space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/dashboard/inbox" className="p-2 -ml-2 text-gray-400 hover:text-gray-600 transition-colors">
              <FaArrowLeft size={14} />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Inbox Analytics</h1>
          </div>
          <p className="text-gray-500 text-sm">Measure team performance and customer response trends.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm">
            <FaCalendarAlt className="text-gray-400 mr-2" size={14} />
            <select 
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="bg-transparent border-none text-sm font-semibold text-gray-700 focus:ring-0 outline-none cursor-pointer"
            >
              <option value="today">Today</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
            </select>
          </div>
          <button className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all shadow-sm">
            <FaDownload className="text-gray-400" size={12} />
            Export Report
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Conversations', value: data?.overview?.total || 0, icon: FaInbox, color: 'blue', trend: '+12%' },
          { label: 'Total Resolved', value: data?.overview?.resolved || 0, icon: FaCheckCircle, color: 'green', trend: '+5%' },
          { label: 'Avg Response Time', value: data?.overview?.avgResponseTime || '14m', icon: FaClock, color: 'purple', trend: '-8%' },
          { label: 'Active Agents', value: data?.overview?.activeAgents || 0, icon: FaUsers, color: 'orange', trend: 'stable' },
        ].map((metric, i) => (
          <motion.div 
            key={metric.label || i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-2xl border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] group hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between">
              <div className={`p-3 rounded-xl bg-${metric.color}-50 text-${metric.color}-600 mb-4 transition-colors group-hover:scale-110 duration-300`}>
                <metric.icon size={22} />
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                metric.trend.includes('+') ? 'bg-green-50 text-green-600' : 
                metric.trend.includes('-') ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-400'
              }`}>
                {metric.trend}
              </span>
            </div>
            <div>
              <h3 className="text-gray-500 text-sm font-semibold mb-1 uppercase tracking-wider">{metric.label}</h3>
              <p className="text-3xl font-extrabold text-gray-900">{metric.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart Card */}
        <div className="lg:col-span-2 bg-white p-8 rounded-2xl border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-bold text-gray-900 tracking-tight">Conversation Trends</h3>
              <p className="text-sm text-gray-400">Comparing new vs resolved chats over time.</p>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#00a884]"></div>
                <span className="text-xs font-bold text-gray-600 uppercase tracking-tighter">Resolved</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-400"></div>
                <span className="text-xs font-bold text-gray-600 uppercase tracking-tighter">New</span>
              </div>
            </div>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.dailyTrends || []}>
                <defs>
                  <linearGradient id="colorNew" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorSpent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00a884" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#00a884" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 500}} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 500}}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', padding: '12px' }}
                />
                <Area type="monotone" dataKey="new" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorNew)" />
                <Area type="monotone" dataKey="resolved" stroke="#00a884" strokeWidth={3} fillOpacity={1} fill="url(#colorSpent)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sidebar Mini Charts */}
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] h-full">
            <h3 className="text-lg font-bold text-gray-900 mb-6 tracking-tight">Resolution by Tag</h3>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data?.tagDistribution || []}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="count"
                  >
                    {(data?.tagDistribution || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-6 space-y-4">
               {data?.tagDistribution?.slice(0, 3).map((tag, i) => (
                  <div key={tag.name || i} className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">{tag.name}</span>
                    <span className="text-sm font-extrabold text-gray-900">{tag.count}</span>
                  </div>
               ))}
            </div>
          </div>
        </div>
      </div>

      {/* Agent Performance Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900 tracking-tight">Agent Performance</h3>
          <button className="text-[#00a884] text-sm font-bold hover:underline">View All Agents</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Agent</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Assigned</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Resolved</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Avg Response</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Load</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data?.agentPerformance?.map((agent) => (
                <tr key={agent.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 font-bold border-2 border-white shadow-sm ring-1 ring-gray-100 uppercase">
                        {agent.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-800">{agent.name}</p>
                        <p className="text-[10px] text-gray-400 font-medium">{agent.role || 'Agent'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center font-extrabold text-gray-700 text-sm">{agent.assigned}</td>
                  <td className="px-6 py-4 text-center">
                    <span className="px-3 py-1 bg-green-50 text-green-600 rounded-lg text-xs font-bold border border-green-100">
                      {agent.resolved}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center font-medium text-gray-600 text-sm">{agent.avgResponseTime}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                       <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(agent.load || 40, 100)}%` }}
                            className="h-full bg-[#00a884]"
                          />
                       </div>
                       <span className="text-[10px] font-bold text-gray-500">{agent.load || 40}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(!data?.agentPerformance || data.agentPerformance.length === 0) && (
            <div className="p-12 text-center text-gray-400">
              <FaChartBar size={32} className="mx-auto mb-4 opacity-20" />
              <p className="text-sm font-medium">No agent activity recorded for this period.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
