"use client";

import React, { useState } from 'react';
import DashboardLayout from "@/components/layout/dashboard-layout";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import SuperAdminPageHeader from '@/components/super-admin/super-admin-page-header';
import { 
  HeartPulse, 
  RefreshCcw, 
  ShieldCheck,
  AlertTriangle,
  Zap,
  Activity,
  Globe,
  Database,
  Server,
  Cloud,
  Timer,
  BarChart3,
  CheckCircle2,
  XCircle,
  MoreVertical,
  ArrowRight,
  Info,
  Clock,
  ExternalLink,
  Map,
  Network
} from "lucide-react";
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export default function HealthPage() {
  const { data: health, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'health'],
    queryFn: async () => {
      const response = await apiClient.get('/super-admin/health');
      return response?.data || response || {};
    },
  });

  const metrics = [
    { label: "Global Uptime", value: "99.982%", icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", change: "+0.02%" },
    { label: "Avg Latency", value: "42.5ms", icon: Activity, color: "text-blue-600", bg: "bg-blue-50", change: "-12ms" },
    { label: "Active Alerts", value: "03", icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50", change: "Stable" },
    { label: "Connected BSPs", value: "14/14", icon: Network, color: "text-indigo-600", bg: "bg-indigo-50", change: "Nominal" },
  ];

  const regions = [
    { name: "AWS - US-East-1 (N. Virginia)", uptime: "99.99%", status: "healthy" },
    { name: "GCP - Europe-West1 (Belgium)", uptime: "98.42%", status: "warning" },
    { name: "Azure - Southeast Asia (Singapore)", uptime: "99.98%", status: "healthy" },
    { name: "AWS - Mumbai (India)", uptime: "99.95%", status: "healthy" },
  ];

  return (
      <div className="flex flex-col gap-8 pb-20 max-w-[1600px] mx-auto p-4 md:p-8 font-inter">
        <SuperAdminPageHeader
          icon={HeartPulse}
          eyebrow="Monitoring"
          title="Infrastructure Health"
          subtitle="Real-time telemetry from global data nodes and BSP gateway providers."
          actions={(
            <Button 
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-xl shadow-emerald-500/20 h-12 px-8 rounded-2xl flex items-center gap-2 group"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCcw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              <span className="text-[10px] uppercase tracking-widest">Manual Refresh</span>
            </Button>
          )}
        />

        {/* Metric Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {metrics.map((stat, i) => (
            <div key={i} className="glass-card p-6 rounded-[2rem] border border-slate-200/50 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <div className={cn("p-3 rounded-2xl", stat.bg)}>
                  <stat.icon className={cn("h-5 w-5", stat.color)} />
                </div>
                <Badge variant="outline" className={cn(
                  "text-[9px] font-black tracking-widest border-none px-2 py-0.5",
                  stat.change.startsWith('+') || stat.change === 'Nominal' ? "bg-emerald-50 text-emerald-600" : 
                  stat.change.startsWith('-') ? "bg-blue-50 text-blue-600" : "bg-slate-50 text-slate-500"
                )}>{stat.change}</Badge>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{stat.label}</span>
                <span className="text-3xl font-black font-manrope tracking-tight mt-1">{isLoading ? <Skeleton className="h-9 w-24" /> : stat.value}</span>
              </div>
              <div className="h-1 w-full bg-slate-50 rounded-full overflow-hidden mt-2">
                <div className={cn("h-full rounded-full transition-all duration-1000", stat.color.replace('text', 'bg'))} style={{ width: '90%' }} />
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Service Health Bars */}
          <div className="lg:col-span-8 space-y-8">
            <div className="glass-card p-8 rounded-[2.5rem] border border-slate-200/50 flex flex-col gap-8">
               <div className="flex justify-between items-center">
                 <h3 className="font-manrope text-lg font-black uppercase tracking-tight flex items-center gap-2">
                   <Server className="h-5 w-5 text-emerald-600" /> Regional Node Status
                 </h3>
                 <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Last 24 Hours</span>
               </div>
               <div className="space-y-8">
                 {regions.map((region, i) => (
                   <div key={i} className="space-y-3">
                     <div className="flex justify-between items-center">
                       <div className="flex items-center gap-3">
                         <div className={cn("h-2 w-2 rounded-full", region.status === 'healthy' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-amber-500")} />
                         <span className="text-xs font-black uppercase tracking-tight text-slate-700">{region.name}</span>
                       </div>
                       <span className="text-[11px] font-black font-mono text-slate-500">{region.uptime}</span>
                     </div>
                     <div className="flex gap-1 h-6">
                       {Array.from({ length: 40 }).map((_, j) => (
                         <div 
                           key={j} 
                           className={cn(
                             "flex-1 rounded-sm transition-all hover:scale-y-110",
                             region.status === 'healthy' ? "bg-emerald-500" : (j > 25 && j < 30 ? "bg-amber-400" : "bg-emerald-500")
                           )}
                           title={`${region.name} - Hour ${j}`}
                         />
                       ))}
                     </div>
                   </div>
                 ))}
               </div>
            </div>

            {/* Performance Snapshot */}
            <div className="glass-card p-8 rounded-[2.5rem] border border-slate-200/50 flex flex-col gap-8">
               <div className="flex justify-between items-center">
                 <h3 className="font-manrope text-lg font-black uppercase tracking-tight flex items-center gap-2">
                   <BarChart3 className="h-5 w-5 text-emerald-600" /> Traffic Throughput
                 </h3>
                 <div className="flex gap-2">
                    <Badge variant="secondary" className="text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-600 border-none">API Gateway</Badge>
                    <Badge variant="secondary" className="text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 border-none">Webhooks</Badge>
                 </div>
               </div>
               <div className="h-48 flex items-end gap-1 px-4 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/5 to-transparent pointer-events-none" />
                  {Array.from({ length: 60 }).map((_, i) => {
                    const h = 20 + Math.random() * 60;
                    return (
                      <div 
                        key={i} 
                        className="flex-1 bg-emerald-500/20 hover:bg-emerald-500/40 transition-all rounded-t-sm" 
                        style={{ height: `${h}%` }}
                      />
                    );
                  })}
               </div>
               <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-muted-foreground border-t border-slate-100 pt-4">
                  <span>08:00 AM</span>
                  <span>12:00 PM</span>
                  <span>04:00 PM</span>
                  <span>08:00 PM</span>
               </div>
            </div>
          </div>

          {/* Incident Log & Map */}
          <div className="lg:col-span-4 space-y-8">
            {/* Incident Ledger */}
            <div className="glass-card rounded-[2.5rem] border border-slate-200/50 flex flex-col shadow-sm overflow-hidden h-fit">
               <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                 <h3 className="font-manrope text-sm font-black uppercase tracking-tight">Active Incident Ledger</h3>
                 <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
               </div>
               <div className="p-2 space-y-2 max-h-[400px] overflow-y-auto">
                 {[
                   { type: 'warning', title: 'Regional Latency Spike', desc: 'GCP Europe-West1 packet loss detected.', time: '14:22 UTC' },
                   { type: 'success', title: 'Node V1.4.2 Deployed', desc: 'Auto-scaling propagation complete.', time: '13:05 UTC' },
                   { type: 'info', title: 'Index Optimization', desc: 'DB maintenance on US-Central-1.', time: '09:00 UTC' },
                   { type: 'success', title: 'Gateway Recovery', desc: 'Latency returned to baseline levels.', time: '08:14 UTC' }
                 ].map((log, i) => (
                   <div key={i} className="p-4 rounded-2xl hover:bg-slate-50 transition-colors flex gap-4">
                     <div className={cn(
                       "h-8 w-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
                       log.type === 'warning' ? "bg-amber-100 text-amber-600" :
                       log.type === 'success' ? "bg-emerald-100 text-emerald-600" :
                       "bg-blue-100 text-blue-600"
                     )}>
                       {log.type === 'warning' ? <AlertTriangle className="h-4 w-4" /> : 
                        log.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <Info className="h-4 w-4" />}
                     </div>
                     <div className="flex flex-col gap-1 overflow-hidden">
                       <div className="flex justify-between items-center gap-2">
                         <span className="font-bold text-xs truncate">{log.title}</span>
                         <span className="text-[9px] font-black text-muted-foreground whitespace-nowrap">{log.time}</span>
                       </div>
                       <p className="text-[10px] text-muted-foreground font-medium leading-relaxed">{log.desc}</p>
                     </div>
                   </div>
                 ))}
               </div>
               <Button variant="ghost" className="m-4 h-10 rounded-xl font-black uppercase tracking-widest text-[9px] border-t border-slate-50 pt-4">View Operational History</Button>
            </div>

            {/* Load Map Card */}
            <div className="glass-card rounded-[2.5rem] border border-slate-200/50 p-8 bg-slate-900 text-white relative overflow-hidden aspect-[4/5] flex flex-col justify-between">
               <div className="absolute inset-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&q=80&w=600')] bg-cover bg-center" />
               <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent pointer-events-none" />
               
               <div className="relative z-10 space-y-2">
                  <h3 className="font-manrope text-xl font-black uppercase tracking-tighter">Global Load</h3>
                  <p className="text-xs text-slate-400 font-medium">Regional distribution of active traffic.</p>
               </div>

               <div className="relative z-10 space-y-4">
                  {[
                    { name: 'North America', val: 42 },
                    { name: 'Europe', val: 31 },
                    { name: 'Asia-Pacific', val: 27 }
                  ].map((l, i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">{l.name}</span>
                        <span className="text-xs font-black text-emerald-400">{l.val}%</span>
                      </div>
                      <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${l.val}%` }} />
                      </div>
                    </div>
                  ))}
                  <Button className="w-full h-11 bg-white/10 hover:bg-white/20 border-white/10 text-white font-black uppercase tracking-widest text-[9px] rounded-2xl mt-4">
                    <Map className="h-3 w-3 mr-2" /> Live Network Map
                  </Button>
               </div>
            </div>
          </div>
        </div>
      </div>
  );
}
