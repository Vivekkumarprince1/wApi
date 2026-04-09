"use client";

import React, { useEffect, useState } from 'react';
import { 
  Loader2, 
  BarChart3, 
  Users, 
  Building2, 
  TrendingUp, 
  Zap, 
  ShieldCheck, 
  Search,
  ArrowUpRight,
  Target,
  DollarSign,
  Smartphone
} from 'lucide-react';
import { getAdminAnalytics } from '@/lib/api';
import { cn } from "@/lib/utils";

const AdminDashboard = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await getAdminAnalytics();
        setAnalytics(res.data || {});
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      }
      setLoading(false);
    };
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const statCards = [
    { label: 'Total Revenue', value: '₹' + (analytics?.overview?.totalRevenue || 0).toLocaleString(), change: '+12.5%', icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Total Tenants', value: analytics?.overview?.totalWorkspaces || 0, change: '+5.2%', icon: Building2, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Active Users', value: analytics?.overview?.activeUsers || 0, change: '+18%', icon: Users, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
    { label: 'Messages Sent', value: (analytics?.overview?.totalMessages || 0).toLocaleString(), change: '+32.4%', icon: Zap, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">Main Dashboard</h1>
          <p className="text-slate-400 mt-2 font-medium">Welcome back, Admin. Here's a platform overview.</p>
        </div>
        <div className="text-right">
          <p className="text-slate-500 text-xs font-black uppercase tracking-widest">Platform Status</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-emerald-500 font-bold text-sm uppercase">Operational</span>
          </div>
        </div>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 hover:border-slate-700 transition-all group">
            <div className="flex justify-between items-start mb-6">
              <div className={cn("p-4 rounded-2xl", card.bg)}>
                <card.icon className={card.color} size={24} />
              </div>
              <div className="flex items-center gap-1 text-emerald-500 text-xs font-bold">
                {card.change} <ArrowUpRight size={14} />
              </div>
            </div>
            <p className="text-slate-500 text-sm font-bold uppercase tracking-wider">{card.label}</p>
            <h3 className="text-3xl font-black text-white mt-1 group-hover:text-blue-400 transition-colors tracking-tighter">
              {card.value}
            </h3>
          </div>
        ))}
      </div>

      {/* Visual Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Verification Status Distribution */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-[3rem] p-10">
          <div className="flex justify-between items-center mb-10">
            <div>
              <h3 className="text-2xl font-bold text-white tracking-tight">Verification Funnel</h3>
              <p className="text-slate-500 text-sm mt-1">Current status of business verification requests</p>
            </div>
            <Target className="text-slate-700" size={32} />
          </div>

          <div className="space-y-6">
            {Object.entries(analytics?.verification || {}).map(([status, count]) => (
              <div key={status} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-300 capitalize">{status}</span>
                  <span className="text-sm font-black text-white">{count} ({Math.round((count / (analytics?.overview?.totalWorkspaces || 1)) * 100)}%)</span>
                </div>
                <div className="h-3 bg-slate-950 border border-slate-800 rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full transition-all duration-1000",
                      status === 'verified' ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 
                      status === 'pending' ? 'bg-amber-500' : 'bg-slate-700'
                    )}
                    style={{ width: `${(count / (analytics?.overview?.totalWorkspaces || 1)) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Plan Distribution Mini-Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-10 flex flex-col">
          <div className="mb-10">
            <h3 className="text-2xl font-bold text-white tracking-tight">Plan Usage</h3>
            <p className="text-slate-500 text-sm mt-1">Revenue tier distribution</p>
          </div>

          <div className="flex-1 space-y-4">
            {Object.entries(analytics?.plans || {}).map(([plan, count]) => (
              <div key={plan} className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-2xl hover:border-blue-500/50 transition-all group">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-sm font-bold text-slate-400 capitalize group-hover:text-white transition-colors">{plan} User</span>
                </div>
                <span className="text-lg font-black text-white">{count}</span>
              </div>
            ))}
          </div>

          <button className="w-full mt-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold transition-all active:scale-[0.98] shadow-lg shadow-blue-900/20">
            View Revenue Reports
          </button>
        </div>
      </div>

      {/* Activity Map / WABA Distribution */}
      <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-10">
        <div className="flex items-center gap-4 mb-10">
          <div className="p-4 bg-amber-500/10 rounded-2xl">
            <Smartphone className="text-amber-500" size={24} />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white tracking-tight">WABA Status Map</h3>
            <p className="text-slate-500 text-sm mt-1">Meta connectivity across the entire platform</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Object.entries(analytics?.wabaStatus || {}).map(([status, count]) => (
            <div key={status} className="bg-slate-950 border border-slate-800 rounded-2xl p-6 text-center hover:border-slate-600 transition-colors">
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-2">{status.replace(/_/g, ' ')}</p>
              <h4 className={cn(
                "text-3xl font-black",
                status === 'completed' ? 'text-emerald-500' : 'text-white'
              )}>
                {count}
              </h4>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
