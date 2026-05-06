"use client";

import React, { useState, useMemo } from 'react';
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
  Server,
  Database,
  Zap,
  Globe,
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Network,
  Cpu,
  HardDrive,
  Wifi,
  Router,
  Cloud,
  Layers,
  Settings,
  Monitor,
  BarChart3,
  TrendingUp,
  Clock,
  Shield,
  Lock,
  Key,
  MessageSquare,
  ArrowRight,
  MoreVertical,
  ExternalLink,
  Info,
  Mail,
  Megaphone,
  CreditCard,
  LucideIcon
} from "lucide-react";
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export default function InfrastructurePage() {
  const [selectedService, setSelectedService] = useState<string | null>(null);

  const { data: infrastructure, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'infrastructure'],
    queryFn: async () => {
      const response = await apiClient.get('/super-admin/infrastructure');
      return response.data || response;
    },
  });

  // Generate chart data once to avoid Math.random in render
  const chartData = useMemo(() => 
    Array.from({ length: 60 }, (_, i) => 20 + ((i * 7) % 40)), 
    []
  );

  const services: Array<{
    name: string;
    status: string;
    uptime: string;
    responseTime: string;
    cpu: string;
    memory: string;
    connections: string;
    icon: string;
    color: string;
    bg: string;
    type: string;
    description: string;
    version?: string;
    region?: string;
    lastHealthCheck?: string;
    latency?: string;
    details?: Record<string, unknown>;
  }> = infrastructure?.services || [];

  const metrics = infrastructure?.metrics || (isLoading ? Array(4).fill({}) : []);

  // Parse the icon names if they come as strings from the backend
  const IconMap = {
    Server, Database, Zap, Globe, Activity, AlertTriangle, 
    CheckCircle2, XCircle, RefreshCw, Network, Cpu, HardDrive, 
    Wifi, Router, Cloud, Layers, Settings, Monitor, BarChart3, 
    TrendingUp, Clock, Shield, Lock, Key, MessageSquare, 
    Megaphone, CreditCard, Mail
  } as Record<string, React.ElementType>;

  const resolvedMetrics = metrics.map(stat => ({
    ...stat,
    icon: typeof stat.icon === 'string' ? (IconMap[stat.icon] || Activity) : (stat.icon || Activity)
  }));

  const resolvedServices = services.map(service => ({
    ...service,
    icon: typeof service.icon === 'string' ? (IconMap[service.icon] || Server) : (service.icon || Server)
  }));

  const activeServiceData = resolvedServices.find(s => s.name === selectedService) || resolvedServices[0];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-amber-600" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-600" />;
      default: return <Info className="h-4 w-4 text-slate-600" />;
    }
  };

  return (
      <div className="flex flex-col gap-8 pb-20 max-w-[1600px] mx-auto p-4 md:p-8 font-inter">
        <SuperAdminPageHeader
          icon={Server}
          eyebrow="Infrastructure"
          title="System Infrastructure"
          subtitle="Monitor all backend services, databases, caches, microservices, and external provider connections."
          actions={(
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-xl shadow-emerald-500/20 h-12 px-8 rounded-2xl flex items-center gap-2 group"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              <span className="text-[10px] uppercase tracking-widest">Refresh Status</span>
            </Button>
          )}
        />

        {/* System Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {resolvedMetrics.map((stat, i) => (
            <div key={i} className="glass-card p-6 rounded-[2rem] border border-slate-200/50 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <div className={cn("p-3 rounded-2xl", stat.bg)}>
                  {React.createElement(stat.icon as React.ElementType, { className: cn("h-5 w-5", stat.color) })}
                </div>
                {stat.change && (
                  <Badge variant="outline" className={cn(
                    "text-[9px] font-black tracking-widest border-none px-2 py-0.5",
                    stat.change.startsWith('+') ? "bg-emerald-50 text-emerald-600" :
                    stat.change.startsWith('-') ? "bg-blue-50 text-blue-600" : "bg-slate-50 text-slate-500"
                  )}>{stat.change}</Badge>
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{stat.label}</span>
                <span className="text-3xl font-black font-manrope tracking-tight mt-1">{isLoading ? <Skeleton className="h-9 w-24" /> : stat.value}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Service Grid */}
          <div className="lg:col-span-8 space-y-8">
            <div className="glass-card p-8 rounded-[2.5rem] border border-slate-200/50 flex flex-col gap-8">
              <div className="flex justify-between items-center">
                <h3 className="font-manrope text-lg font-black uppercase tracking-tight flex items-center gap-2">
                  <Layers className="h-5 w-5 text-emerald-600" /> Service Directory
                </h3>
                <div className="flex gap-2">
                  <Badge className="bg-emerald-500/10 text-emerald-600 border-none font-black text-[9px] uppercase tracking-widest">7 Healthy</Badge>
                  <Badge className="bg-amber-500/10 text-amber-600 border-none font-black text-[9px] uppercase tracking-widest">1 Warning</Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {resolvedServices.map((service, i) => (
                  <div
                    key={i}
                    className={cn(
                      "p-6 rounded-3xl border transition-all cursor-pointer hover:shadow-lg",
                      selectedService === service.name ? "border-emerald-500 bg-emerald-50/50" : "border-slate-200/50 bg-white hover:border-slate-300"
                    )}
                    onClick={() => setSelectedService(selectedService === service.name ? null : service.name)}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={cn("p-2.5 rounded-2xl", service.bg)}>
                          {React.createElement(service.icon as React.ElementType, { className: cn("h-5 w-5", service.color) })}
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-foreground">{service.name}</h4>
                          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{service.type}</p>
                        </div>
                      </div>
                      {getStatusIcon(service.status)}
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-[10px]">
                      <div>
                        <span className="font-black uppercase tracking-widest text-muted-foreground">Uptime</span>
                        <p className="font-bold text-sm">{service.uptime}</p>
                      </div>
                      <div>
                        <span className="font-black uppercase tracking-widest text-muted-foreground">Latency</span>
                        <p className="font-bold text-sm">{service.latency}</p>
                      </div>
                      <div>
                        <span className="font-black uppercase tracking-widest text-muted-foreground">Connections</span>
                        <p className="font-bold text-sm">{service.connections}</p>
                      </div>
                      <div>
                        <span className="font-black uppercase tracking-widest text-muted-foreground">Memory</span>
                        <p className="font-bold text-sm">{service.memory}</p>
                      </div>
                    </div>

                    {selectedService === service.name && (
                      <div className="mt-4 pt-4 border-t border-slate-200/50">
                        <div className="grid grid-cols-2 gap-3 text-[9px]">
                          {service.details && Object.entries(service.details).map(([key, value]) => (
                            <div key={key}>
                              <span className="font-black uppercase tracking-widest text-muted-foreground">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                              <p className="font-bold text-xs mt-0.5">{String(value)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Performance Charts */}
            <div className="glass-card p-8 rounded-[2.5rem] border border-slate-200/50 flex flex-col gap-8">
              <div className="flex justify-between items-center">
                <h3 className="font-manrope text-lg font-black uppercase tracking-tight flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-emerald-600" /> System Performance
                </h3>
                <div className="flex gap-2">
                  <Badge variant="secondary" className="text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-600 border-none">Response Time</Badge>
                  <Badge variant="secondary" className="text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 border-none">Throughput</Badge>
                </div>
              </div>

              <div className="h-48 flex items-end gap-1 px-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/5 to-transparent pointer-events-none" />
                {chartData.map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-emerald-500/20 hover:bg-emerald-500/40 transition-all rounded-t-sm"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>

              <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-muted-foreground border-t border-slate-100 pt-4">
                <span>00:00</span>
                <span>06:00</span>
                <span>12:00</span>
                <span>18:00</span>
                <span>23:59</span>
              </div>
            </div>
          </div>

          {/* Side Panel */}
          <div className="lg:col-span-4 space-y-8">
            {/* Service Health Summary */}
            <div className="glass-card p-8 rounded-[2.5rem] border border-slate-200/50 flex flex-col gap-6 shadow-sm">
              <div className="flex justify-between items-center">
                <h3 className="font-manrope text-sm font-black uppercase tracking-tight flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-emerald-600" /> Service Health
                </h3>
                <Badge className="bg-emerald-500/10 text-emerald-600 border-none font-black text-[9px] uppercase tracking-widest px-3 py-1">{infrastructure?.overallHealth || '98.7%'}</Badge>
              </div>

              <div className="space-y-4">
                {[
                  { name: 'Core Services', value: infrastructure?.health?.coreServices || 100, color: 'bg-emerald-500' },
                  { name: 'Microservices', value: infrastructure?.health?.microservices || 95, color: 'bg-blue-500' },
                  { name: 'Databases', value: infrastructure?.health?.databases || 98, color: 'bg-purple-500' },
                  { name: 'External APIs', value: infrastructure?.health?.externalApis || 97, color: 'bg-slate-500' }
                ].map((s, i) => (
                  <div key={i} className="p-4 rounded-3xl bg-slate-50/50 border border-slate-100 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">{s.name}</span>
                      <span className="text-xs font-black">{s.value}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-white rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full", s.color)} style={{ width: `${s.value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card p-8 rounded-[2.5rem] border border-slate-200/50 flex flex-col gap-6 shadow-sm">
              <h3 className="font-manrope text-sm font-black uppercase tracking-tight flex items-center gap-2">
                <Settings className="h-4 w-4 text-emerald-600" /> Quick Actions
              </h3>

              <div className="space-y-3">
                <Button 
                  className="w-full h-11 bg-white border border-slate-200 hover:bg-slate-50 text-slate-900 font-black uppercase tracking-widest text-[10px] rounded-2xl"
                  onClick={async () => {
                    if (confirm("Are you sure you want to clear all platform caches?")) {
                      await apiClient.post('/super-admin/actions', { action: 'clear-cache' });
                      alert("Cache purged successfully");
                    }
                  }}
                >
                  <Zap className="h-3 w-3 mr-2 text-blue-500" /> Purge Cache
                </Button>
                <Button 
                  className="w-full h-11 bg-white border border-slate-200 hover:bg-slate-50 text-slate-900 font-black uppercase tracking-widest text-[10px] rounded-2xl"
                  onClick={() => window.location.href = '/super-admin/control-center'}
                >
                  <Monitor className="h-3 w-3 mr-2 text-emerald-500" /> System Control Center
                </Button>
                <Button 
                  className="w-full h-11 bg-white border border-slate-200 hover:bg-slate-50 text-slate-900 font-black uppercase tracking-widest text-[10px] rounded-2xl"
                  onClick={() => window.location.href = '/super-admin/data-explorer'}
                >
                  <Database className="h-3 w-3 mr-2 text-purple-500" /> Database Explorer
                </Button>
              </div>
            </div>

            {/* Recent Alerts */}
            <div className="glass-card rounded-[2.5rem] border border-slate-200/50 flex flex-col shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <h3 className="font-manrope text-sm font-black uppercase tracking-tight">Recent Alerts</h3>
                <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              </div>
              <div className="p-2 space-y-2 max-h-[300px] overflow-y-auto">
                {(infrastructure?.alerts || [
                  { type: 'warning' as const, title: 'High Memory Usage', desc: 'Redis cache at 85% capacity', time: '12:34 UTC' },
                  { type: 'info' as const, title: 'Service Restarted', desc: 'Auth service restarted successfully', time: '11:22 UTC' },
                  { type: 'success' as const, title: 'Connection Restored', desc: 'MongoDB replica sync completed', time: '10:15 UTC' }
                ]).map((alert: { type: 'warning' | 'info' | 'success', title: string, desc: string, time: string }, i: number) => (
                  <div key={i} className="p-4 rounded-2xl hover:bg-slate-50 transition-colors flex gap-4">
                    <div className={cn(
                      "h-8 w-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
                      alert.type === 'warning' ? "bg-amber-100 text-amber-600" :
                      alert.type === 'success' ? "bg-emerald-100 text-emerald-600" :
                      "bg-blue-100 text-blue-600"
                    )}>
                      {alert.type === 'warning' ? <AlertTriangle className="h-4 w-4" /> :
                       alert.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> :
                       <Info className="h-4 w-4" />}
                    </div>
                    <div className="flex flex-col gap-1 overflow-hidden">
                      <div className="flex justify-between items-center gap-2">
                        <span className="font-bold text-xs truncate">{alert.title}</span>
                        <span className="text-[9px] font-black text-muted-foreground whitespace-nowrap">{alert.time}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground font-medium leading-relaxed">{alert.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}