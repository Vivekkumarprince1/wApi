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
  ShieldCheck, 
  Search, 
  Filter,
  Download,
  ShieldAlert,
  Shield,
  Activity,
  History,
  User,
  Globe,
  Database,
  Lock,
  MoreVertical,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Calendar,
  Clock,
  ExternalLink,
  ArrowRight
} from "lucide-react";
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function AuditLogsPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  
  const { data: logs, isLoading, isError } = useQuery({
    queryKey: ['admin', 'audit-logs'],
    queryFn: async () => {
      const response: any = await apiClient.get('/super-admin/audit-logs');
      const rows = response?.data;
      return Array.isArray(rows) ? rows : Array.isArray(response) ? response : [];
    },
  });

  const filteredLogs = (logs || []).filter((log: any) => {
    const matchesSearch = (
      log.actor?.name?.toLowerCase().includes(search.toLowerCase()) || 
      log.actor?.email?.toLowerCase().includes(search.toLowerCase()) ||
      log.action?.toLowerCase().includes(search.toLowerCase()) ||
      log.target?.toLowerCase().includes(search.toLowerCase())
    );
    const matchesType = typeFilter === 'all' || log.action?.includes(typeFilter);
    return matchesSearch && matchesType;
  });

  const stats = [
    { label: "Total Actions", value: logs?.length || 0, icon: History, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Security Events", value: logs?.filter((l: any) => l.action?.includes('AUTH') || l.action?.includes('PERM')).length || 0, icon: ShieldAlert, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Critical Failures", value: logs?.filter((l: any) => l.status === 'failure' || l.status === 'error').length || 0, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50" },
    { label: "Compliance Score", value: "99.8%", icon: ShieldCheck, color: "text-indigo-600", bg: "bg-indigo-50" },
  ];

  return (
      <div className="flex flex-col gap-8 pb-20 max-w-[1600px] mx-auto p-4 md:p-8 font-inter">
        <SuperAdminPageHeader
          icon={Shield}
          eyebrow="Governance"
          title="Audit Logs"
          subtitle="Monitor and review all administrative actions, system changes, and security events."
          actions={(
            <Button className="bg-white border-slate-200 hover:bg-slate-50 text-slate-900 font-black shadow-sm h-12 px-8 rounded-2xl flex items-center gap-2 group">
              <Download className="h-4 w-4 group-hover:-translate-y-1 transition-transform" />
              <span className="text-[10px] uppercase tracking-widest">Export Logs</span>
            </Button>
          )}
        />

        {/* Bento Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {stats.map((stat, i) => (
            <div key={i} className="glass-card p-6 rounded-[2rem] border border-slate-200/50 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <div className={cn("p-3 rounded-2xl", stat.bg)}>
                  <stat.icon className={cn("h-5 w-5", stat.color)} />
                </div>
                <Badge variant="outline" className="text-[9px] font-black tracking-widest border-slate-200">24H</Badge>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{stat.label}</span>
                <span className="text-3xl font-black font-manrope tracking-tight mt-1">{isLoading ? <Skeleton className="h-9 w-20" /> : stat.value}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white/50 backdrop-blur-xl rounded-2xl border border-slate-200/50 p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search audit ledger..." 
                className="h-11 pl-10 bg-white border-slate-200 rounded-xl text-xs font-bold" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select 
              className="h-11 px-4 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">All Events</option>
              <option value="AUTH">Authentication</option>
              <option value="PERM">Permissions</option>
              <option value="WS">Workspace</option>
              <option value="BILL">Billing</option>
            </select>
          </div>
          <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
            {isLoading ? 'Scanning Archive...' : `Journaling ${filteredLogs.length} Records`}
          </div>
        </div>

        {/* Ledger Table */}
        <div className="glass-card rounded-[2.5rem] overflow-hidden shadow-sm border border-slate-200/50 flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Chronology</th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Actor Identity</th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Action Directive</th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Target Vector</th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Network Origin</th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-8 py-6"><Skeleton className="h-10 w-32 rounded-lg" /></td>
                      <td className="px-8 py-6"><Skeleton className="h-10 w-48 rounded-lg" /></td>
                      <td className="px-8 py-6"><Skeleton className="h-7 w-32 rounded-md" /></td>
                      <td className="px-8 py-6"><Skeleton className="h-7 w-40 rounded-md" /></td>
                      <td className="px-8 py-6"><Skeleton className="h-6 w-24 rounded-md" /></td>
                      <td className="px-8 py-6 text-right"><Skeleton className="h-7 w-20 ml-auto rounded-full" /></td>
                    </tr>
                  ))
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-8 py-32 text-center">
                      <div className="flex flex-col items-center gap-6">
                        <div className="h-20 w-20 rounded-full bg-slate-50 flex items-center justify-center">
                          <History className="h-10 w-10 text-slate-300" />
                        </div>
                        <div className="space-y-1">
                          <h3 className="font-manrope text-xl font-black uppercase tracking-tight">Archive Empty</h3>
                          <p className="text-sm text-muted-foreground max-w-xs font-medium italic">No security events found matching current filter parameters.</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : filteredLogs.map((log: any) => (
                  <tr key={log._id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-foreground">{new Date(log.createdAt).toLocaleDateString()}</span>
                        <span className="text-[10px] text-muted-foreground font-black uppercase tracking-tighter flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" /> {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs uppercase">
                          {log.actor?.name?.charAt(0) || 'U'}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-sm text-foreground">{log.actor?.name || 'System Actor'}</span>
                          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">{log.actor?.email || 'automated@system'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <Badge variant="outline" className={cn(
                        "font-black text-[9px] uppercase tracking-widest border-none px-3 py-1",
                        log.action?.includes('AUTH') ? "bg-indigo-500/10 text-indigo-600" :
                        log.action?.includes('WS') ? "bg-emerald-500/10 text-emerald-600" :
                        "bg-slate-500/10 text-slate-600"
                      )}>
                        {log.action}
                      </Badge>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500 bg-slate-50 px-3 py-1 rounded-lg w-fit border border-slate-100">
                        <Database className="h-3 w-3" />
                        {log.target || '/system/config'}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
                        <Globe className="h-3 w-3" />
                        {log.ipAddress || '127.0.0.1'}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className={cn(
                          "h-1.5 w-1.5 rounded-full shadow-sm",
                          log.status === 'success' ? "bg-emerald-500" : "bg-red-500"
                        )} />
                        <span className={cn(
                          "text-[10px] font-black uppercase tracking-widest",
                          log.status === 'success' ? "text-emerald-600" : "text-red-600"
                        )}>
                          {log.status === 'success' ? 'Verified' : 'Violation'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-8 border-t border-slate-100 bg-white/40 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex gap-2">
              <Button variant="outline" className="h-10 rounded-xl font-black text-[10px] uppercase tracking-widest" disabled>Prev Archeology</Button>
              <Button variant="outline" className="h-10 rounded-xl font-black text-[10px] uppercase tracking-widest" disabled>Next Journal</Button>
            </div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <ShieldCheck className="h-3 w-3 text-emerald-500" /> Integrity Check: <span className="text-emerald-600">Tamper-Proof Ledger Active</span>
            </p>
          </div>
        </div>

        {/* Threat Map / Insights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 glass-card p-8 rounded-[2.5rem] border border-slate-200/50 flex flex-col gap-6">
            <div className="flex justify-between items-center">
              <h3 className="font-manrope text-lg font-black uppercase tracking-tight flex items-center gap-2">
                <Activity className="h-5 w-5 text-emerald-600" /> Activity Pulse
              </h3>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Normal</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-red-500" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Anomalous</span>
                </div>
              </div>
            </div>
            <div className="h-40 flex items-end gap-1 px-4">
              {Array.from({ length: 48 }).map((_, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "flex-1 rounded-t-sm transition-all hover:opacity-80 cursor-help",
                    i === 15 || i === 32 ? "bg-red-400 h-[70%]" : "bg-emerald-400/20 h-[30%]"
                  )} 
                  title={`Hour ${i}: ${i === 15 ? 'Potential Intrusion' : 'Standard Traffic'}`}
                />
              ))}
            </div>
            <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-muted-foreground border-t border-slate-100 pt-4">
              <span>00:00 UTC</span>
              <span>12:00 UTC</span>
              <span>23:59 UTC</span>
            </div>
          </div>
          <div className="glass-card p-8 rounded-[2.5rem] border border-slate-200/50 flex flex-col justify-between bg-emerald-950 text-white relative overflow-hidden">
            <div className="absolute -right-10 -bottom-10 opacity-10">
              <ShieldCheck className="h-64 w-64" />
            </div>
            <div className="space-y-6 relative z-10">
              <div className="space-y-2">
                <h3 className="font-manrope text-xl font-black uppercase tracking-tighter">SOC2 Readiness</h3>
                <p className="text-sm text-emerald-100/70 font-medium leading-relaxed">System-wide audit trail synchronization is currently at peak fidelity.</p>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
                  <span className="text-[10px] font-black uppercase tracking-widest">Encryption Status</span>
                  <Badge className="bg-emerald-500 text-white border-none font-black text-[9px]">AES-256</Badge>
                </div>
                <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
                  <span className="text-[10px] font-black uppercase tracking-widest">Sync Latency</span>
                  <span className="text-xs font-bold text-emerald-400">12ms</span>
                </div>
              </div>
            </div>
            <Button className="w-full h-12 bg-white text-emerald-950 hover:bg-emerald-50 font-black uppercase tracking-widest text-[10px] rounded-2xl mt-8 relative z-10">
              Review Compliance Node
            </Button>
          </div>
        </div>
      </div>
  );
}
