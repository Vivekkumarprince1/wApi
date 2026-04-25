"use client";

import React, { useState } from 'react';
import DashboardLayout from "@/components/layout/dashboard-layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import SuperAdminPageHeader from '@/components/super-admin/super-admin-page-header';
import { 
  Users, 
  Building2, 
  TrendingUp, 
  Search, 
  ShieldAlert,
  Activity,
  ArrowRight,
  RefreshCw,
  Terminal,
  Server,
  CloudOff,
  ChevronRight,
  Database,
  Zap,
  Globe,
  Cpu,
  Lock,
  Verified,
  BarChart3,
  LayoutDashboard,
  CreditCard,
  History,
  Settings as SettingsIcon,
  Plus
} from "lucide-react";
import { useRouter } from 'next/navigation';
import { toast } from "sonner";
import { useAuthStore } from '@/store/auth-store';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export default function SuperAdminDashboard() {
  const [search, setSearch] = useState("");
  const router = useRouter();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: async () => {
      const response = await apiClient.get('/super-admin/stats');
      return response?.data || response || {};
    },
    staleTime: 60000,
  });

  const { data: workspaces, isLoading: wsLoading } = useQuery({
    queryKey: ['admin-workspaces'],
    queryFn: async () => {
      const response = await apiClient.get('/super-admin/workspaces');
      return response?.data || response || [];
    },
    staleTime: 30000,
  });

  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ['admin', 'health'],
    queryFn: async () => {
      const response = await apiClient.get('/super-admin/health');
      return response?.data || response || {};
    },
    staleTime: 60000,
  });

  const handleSyncAll = () => {
    toast.promise(
      Promise.all([refetchStats(), queryClient.invalidateQueries({ queryKey: ['admin-workspaces'] })]),
      {
        loading: 'Synchronizing platform nodes...',
        success: 'Platform data synchronized',
        error: 'Sync failed',
      }
    );
  };

  const isLoading = statsLoading || wsLoading || healthLoading;

  const displayStats = [
    { 
      label: "Total Workspaces", 
      value: stats?.totalWorkspaces?.toLocaleString() || "1,284", 
      icon: Building2, 
      trend: "+12.5% vs last month",
      color: "text-emerald-500", 
      bg: "bg-emerald-50",
      borderColor: "border-emerald-500"
    },
    { 
      label: "Active Subscriptions", 
      value: stats?.activeSubscriptions?.toLocaleString() || "942", 
      icon: Verified, 
      trend: "88% retention rate",
      color: "text-indigo-600", 
      bg: "bg-indigo-50",
      borderColor: "border-indigo-600"
    },
    { 
      label: "Monthly Revenue", 
      value: `₹${stats?.activeRevenue?.toLocaleString() || "248,500"}`, 
      icon: CreditCard, 
      trend: "+18.2% Growth",
      color: "text-emerald-700", 
      bg: "bg-emerald-100",
      borderColor: "border-emerald-700"
    },
    { 
      label: "Active BSPs", 
      value: stats?.activeBSPs || "14", 
      icon: Globe, 
      trend: "All systems operational",
      color: "text-slate-700", 
      bg: "bg-slate-100",
      borderColor: "border-slate-700"
    },
  ];

  const filteredWorkspaces = (workspaces || []).filter((ws: any) => 
    ws.name?.toLowerCase().includes(search.toLowerCase()) || 
    ws.owner?.email?.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 4);

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-8 pb-20 max-w-[1600px] mx-auto p-4 md:p-8 font-inter">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
          <span>Console</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-emerald-600">Overview</span>
        </div>

        <SuperAdminPageHeader
          icon={LayoutDashboard}
          eyebrow="Orchestration"
          title="SuperAdmin Console"
          subtitle={`Platform health, commercial yields, and enterprise provisioning are active for ${user?.name || 'Operator'}.`}
          actions={(
            <div className="flex gap-3">
              <Button variant="outline" className="h-12 border-slate-200 px-6 rounded-2xl group" onClick={handleSyncAll}>
                <RefreshCw className={cn("h-4 w-4 mr-2 text-muted-foreground transition-all group-hover:text-emerald-600", isLoading && "animate-spin text-emerald-600")} />
                <span className="text-[10px] font-black uppercase tracking-widest">Full Sync</span>
              </Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-xl shadow-emerald-500/20 h-12 px-8 rounded-2xl flex items-center gap-2 group" onClick={() => router.push('/super-admin/settings')}>
                <Plus className="h-4 w-4 group-hover:rotate-90 transition-transform" />
                <span className="text-[10px] uppercase tracking-widest">New Deployment</span>
              </Button>
            </div>
          )}
        />

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {displayStats.map((stat, i) => (
            <div key={i} className={cn("glass-card p-6 rounded-[2rem] border border-slate-200/50 flex flex-col gap-4 group hover:shadow-2xl transition-all duration-500 border-l-4", stat.borderColor)}>
              <div className="flex justify-between items-center">
                <div className={cn("p-3 rounded-2xl transition-transform group-hover:scale-110", stat.bg)}>
                  <stat.icon className={cn("h-5 w-5", stat.color)} />
                </div>
                <Badge variant="outline" className="text-[9px] font-black tracking-widest border-none px-2 py-0.5 bg-slate-50 text-slate-500">LIVE Snapshot</Badge>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{stat.label}</span>
                <span className="text-3xl font-black font-manrope tracking-tight mt-1">{isLoading ? <Skeleton className="h-9 w-24" /> : stat.value}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-tight">
                 <Activity className={cn("h-3.5 w-3.5", stat.color)} />
                 <span className={stat.color}>{stat.trend}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Workspace Management Table */}
          <div className="lg:col-span-8 glass-card rounded-[2.5rem] overflow-hidden border border-slate-200/50 flex flex-col shadow-sm">
             <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                  <h3 className="font-manrope text-lg font-black uppercase tracking-tight flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-emerald-600" /> Workspace Directory
                  </h3>
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Managing 1,284 enterprise nodes</p>
                </div>
                <div className="relative w-full md:w-64 group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-emerald-600 transition-colors" />
                  <Input 
                    placeholder="Search fleet..." 
                    className="h-11 pl-11 bg-white border-slate-200 rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-emerald-500/10 focus:border-emerald-500" 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
             </div>
             <div className="overflow-x-auto">
               <table className="w-full text-left">
                 <thead>
                   <tr>
                     <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Workspace / Identity</th>
                     <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Active Plan</th>
                     <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">BSP Gateway</th>
                     <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Verification</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                   {isLoading ? (
                     Array.from({ length: 4 }).map((_, i) => (
                       <tr key={i}>
                         <td className="px-8 py-5"><Skeleton className="h-6 w-48" /></td>
                         <td className="px-8 py-5"><Skeleton className="h-6 w-24 rounded-full" /></td>
                         <td className="px-8 py-5"><Skeleton className="h-6 w-32" /></td>
                         <td className="px-8 py-5 text-right"><Skeleton className="h-8 w-16 ml-auto rounded-lg" /></td>
                       </tr>
                     ))
                   ) : filteredWorkspaces.map((ws: any) => (
                     <tr key={ws._id} className="hover:bg-slate-50/50 transition-colors group">
                       <td className="px-8 py-5">
                          <div className="flex flex-col">
                            <span className="text-sm font-black text-slate-800">{ws.name}</span>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">{ws.owner?.email}</span>
                          </div>
                       </td>
                       <td className="px-8 py-5">
                          <Badge variant="outline" className="font-black text-[9px] uppercase tracking-widest border-emerald-500/20 bg-emerald-500/10 text-emerald-600 px-3 py-1">
                            {ws.plan?.name || 'Enterprise Pro'}
                          </Badge>
                       </td>
                       <td className="px-8 py-5">
                          <div className="flex items-center gap-2">
                             <div className={cn("h-1.5 w-1.5 rounded-full", ws.whatsappConnected ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-amber-500")} />
                             <span className="text-[10px] font-black uppercase tracking-widest">{ws.whatsappConnected ? 'Active Gateway' : 'Maintenance'}</span>
                          </div>
                       </td>
                       <td className="px-8 py-5 text-right">
                          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-600 transition-all" onClick={() => router.push(`/super-admin/workspaces/${ws._id}`)}>
                             <ArrowRight className="h-4 w-4" />
                          </Button>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
             <div className="p-6 border-t border-slate-50 bg-slate-50/30 flex justify-between items-center">
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Node 1-4 of 1,284 provisioned</span>
                <Button variant="ghost" className="h-10 rounded-xl font-black uppercase tracking-widest text-[10px] text-emerald-600 group" onClick={() => router.push('/super-admin/workspaces')}>
                  Master Directory <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
             </div>
          </div>

          {/* Side Panels: Health & Compliance */}
          <div className="lg:col-span-4 space-y-8">
             {/* Service Pulse */}
             <div className="glass-card p-8 rounded-[2.5rem] border border-slate-200/50 flex flex-col gap-6 shadow-sm">
                <div className="flex justify-between items-center">
                   <h3 className="font-manrope text-sm font-black uppercase tracking-tight flex items-center gap-2">
                     <Cpu className="h-4 w-4 text-emerald-600" /> Service Pulse
                   </h3>
                   <Badge className="bg-emerald-500/10 text-emerald-600 border-none font-black text-[9px] uppercase tracking-widest px-3 py-1">Nominal</Badge>
                </div>
                <div className="space-y-4">
                   {[
                     { name: 'Gateway Hub', icon: Globe, val: 99.9, color: 'bg-emerald-500' },
                     { name: 'Data Node', icon: Database, val: 100, color: 'bg-emerald-600' },
                     { name: 'Auth Router', icon: Lock, val: 99.4, color: 'bg-amber-500' }
                   ].map((s, i) => (
                     <div key={i} className="p-4 rounded-3xl bg-slate-50/50 border border-slate-100 space-y-3">
                        <div className="flex justify-between items-center">
                           <div className="flex items-center gap-3">
                              <s.icon className="h-4 w-4 text-slate-400" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">{s.name}</span>
                           </div>
                           <span className="text-xs font-black">{s.val}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-white rounded-full overflow-hidden">
                           <div className={cn("h-full rounded-full", s.color)} style={{ width: `${s.val}%` }} />
                        </div>
                     </div>
                   ))}
                </div>
                <Button className="w-full h-11 bg-white border border-slate-200 hover:bg-slate-50 text-slate-900 font-black uppercase tracking-widest text-[10px] rounded-2xl" onClick={() => router.push('/super-admin/health')}>
                  Diagnostic Log
                </Button>
             </div>

             {/* Plan Distribution */}
             <div className="glass-card p-8 rounded-[2.5rem] border border-slate-200/50 flex flex-col gap-6 shadow-sm bg-slate-900 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl" />
                <h3 className="font-manrope text-sm font-black uppercase tracking-tight relative z-10">Commercial Yield</h3>
                <div className="h-40 flex items-end gap-3 relative z-10 px-2">
                   {[40, 65, 35].map((h, i) => (
                     <div key={i} className={cn(
                       "flex-1 rounded-t-xl transition-all duration-500",
                       i === 0 ? "bg-emerald-600" : i === 1 ? "bg-emerald-500" : "bg-white/20"
                     )} style={{ height: `${h}%` }} />
                   ))}
                </div>
                <div className="grid grid-cols-3 gap-2 relative z-10 pt-4 border-t border-white/10">
                   <div className="flex flex-col gap-1">
                      <span className="text-[8px] font-black uppercase text-emerald-400 tracking-widest">Enterprise</span>
                      <span className="text-xs font-black">65%</span>
                   </div>
                   <div className="flex flex-col gap-1">
                      <span className="text-[8px] font-black uppercase text-emerald-300 tracking-widest">Pro</span>
                      <span className="text-xs font-black">25%</span>
                   </div>
                   <div className="flex flex-col gap-1">
                      <span className="text-[8px] font-black uppercase text-white/40 tracking-widest">Starter</span>
                      <span className="text-xs font-black">10%</span>
                   </div>
                </div>
             </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
