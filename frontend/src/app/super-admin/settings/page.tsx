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
import { Textarea } from "@/components/ui/textarea"; // from control-center
import SuperAdminPageHeader from '@/components/super-admin/super-admin-page-header';
import { 
  Settings, 
  Save, 
  ShieldCheck,
  Key,
  Bell,
  Globe,
  Database,
  Lock,
  Server,
  Cloud,
  Zap,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Mail,
  MessageSquare,
  Eye,
  Trash2,
  Copy,
  Check,
  Loader2,
  Plus,
  Hash,
  Activity,
  AlertCircle,
  Megaphone,
  Info,
  RefreshCw
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  
  // Control center states
  const [broadcast, setBroadcast] = useState({ title: '', message: '', level: 'info' as const });

  // Settings Query
  const { data: settings, isLoading: isSettingsLoading } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: async () => {
      const response = await apiClient.get('/super-admin/settings');
      return response?.data || response || {};
    },
  });

  // Control Plane Snapshot Query
  const { data: snapshot, isLoading: isSnapshotLoading } = useQuery({
    queryKey: ['admin', 'control-plane'],
    queryFn: async () => {
      const resp = await apiClient.get('/super-admin/control-plane');
      return resp.data.snapshot;
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: any) => {
      return await apiClient.patch('/super-admin/settings', payload);
    },
    onSuccess: () => {
      toast.success("Platform configurations synchronized");
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
    },
    onError: () => {
      toast.error("Failed to update system settings");
    }
  });

  // Control Center Mutations
  const actionMutation = useMutation({
    mutationFn: async (data: { action: string; payload?: any }) => {
      return apiClient.post('/super-admin/actions', data);
    },
    onSuccess: (resp) => {
      toast.success(resp.message || "Action executed successfully");
      queryClient.invalidateQueries({ queryKey: ['admin', 'control-plane'] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to execute action");
    }
  });

  const handleToggleMaintenance = (enabled: boolean) => {
    const message = enabled ? prompt("Enter maintenance message:", "System is currently undergoing scheduled maintenance.") : "";
    if (enabled && message === null) return;
    actionMutation.mutate({ action: 'maintenance-mode', payload: { enabled, message } });
  };

  const handleToggleLockdown = (enabled: boolean) => {
    if (!enabled) return; // Cannot easily undo lockdown without manual intervention
    if (confirm("CRITICAL: You are about to initiate an Emergency Lockdown. This will purge ALL sessions and put the system into permanent maintenance mode. Continue?")) {
      const reason = prompt("Enter reason for lockdown:", "Security breach detected");
      if (reason) {
        actionMutation.mutate({ action: 'emergency-freeze', payload: { reason } });
      }
    }
  };

  const handleBroadcast = () => {
    if (!broadcast.message) return toast.error("Message is required");
    actionMutation.mutate({ action: 'broadcast', payload: broadcast });
    setBroadcast({ title: '', message: '', level: 'info' });
  };

  const handleCopy = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
    toast.success("API Key copied to clipboard");
  };

  return (
      <div className="flex flex-col gap-8 pb-20 max-w-[1600px] mx-auto p-4 md:p-8 font-inter animate-in fade-in duration-700">
        <SuperAdminPageHeader
          icon={Settings}
          eyebrow="Governance"
          title="Global Settings & Control"
          subtitle="Configure platform-wide settings, manage system availability, and enforce security protocols."
          actions={(
            <div className="flex items-center gap-3">
                <Button 
                variant="outline" 
                className="rounded-2xl border-slate-200 hover:bg-slate-50 font-black tracking-widest text-[10px] uppercase h-12 px-6"
                onClick={() => queryClient.invalidateQueries({ queryKey: ['admin', 'control-plane'] })}
                >
                <RefreshCw className={cn("h-4 w-4 mr-2", isSnapshotLoading && "animate-spin")} />
                Sync State
                </Button>
                <Button 
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-xl shadow-emerald-500/20 h-12 px-8 rounded-2xl flex items-center gap-2 group"
                onClick={() => updateMutation.mutate({})}
                disabled={updateMutation.isPending}
                >
                {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span className="text-[10px] uppercase tracking-widest">Commit Changes</span>
                </Button>
            </div>
          )}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Platform Config */}
          <div className="lg:col-span-7 space-y-8">
            <div className="glass-card p-8 rounded-[2.5rem] border border-slate-200/50 flex flex-col gap-8 shadow-2xl shadow-slate-200/20">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-emerald-50 rounded-2xl">
                    <Globe className="h-5 w-5 text-emerald-600" />
                  </div>
                  <h3 className="font-manrope text-lg font-black uppercase tracking-tight">System Configuration</h3>
                </div>
                {snapshot?.systemStatus?.maintenanceMode && (
                    <Badge className="bg-red-500 text-white font-black tracking-widest text-[10px] uppercase px-4 py-1.5 rounded-full border-none shadow-sm animate-pulse">
                      Maintenance Active
                    </Badge>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Enterprise Name</Label>
                  <Input 
                    defaultValue={settings?.appName || 'wApi'} 
                    className="h-12 rounded-2xl bg-slate-50 border-slate-100 font-bold focus:ring-emerald-500/20"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Data Retention (Days)</Label>
                  <Input 
                    type="number" 
                    defaultValue="90" 
                    className="h-12 rounded-2xl bg-slate-50 border-slate-100 font-bold focus:ring-emerald-500/20"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Storage Ceiling (TB)</Label>
                  <Input 
                    type="number" 
                    defaultValue="10" 
                    className="h-12 rounded-2xl bg-slate-50 border-slate-100 font-bold focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              {/* Maintenance Protocol replaced with advanced version */}
              <div className={cn(
                "p-6 rounded-[2rem] border transition-all duration-500",
                snapshot?.systemStatus?.maintenanceMode ? "bg-red-50/50 border-red-200" : "bg-emerald-50/50 border-emerald-100"
              )}>
                <div className="flex justify-between items-start mb-6">
                  <div className="flex flex-col gap-1">
                    <span className={cn("font-black tracking-widest text-[10px] uppercase", snapshot?.systemStatus?.maintenanceMode ? "text-red-600" : "text-emerald-900")}>Maintenance Protocol</span>
                    <p className="text-xs font-medium leading-relaxed text-muted-foreground">Block all non-admin access instantly for system updates.</p>
                  </div>
                  <Switch 
                    checked={snapshot?.systemStatus?.maintenanceMode || false} 
                    onCheckedChange={handleToggleMaintenance}
                    className="data-[state=checked]:bg-red-600"
                  />
                </div>
                {snapshot?.systemStatus?.maintenanceMode && (
                  <div className="mt-4 p-4 bg-white/50 border border-red-100 rounded-2xl text-[11px] font-medium text-red-700 leading-relaxed italic">
                    "{snapshot?.systemStatus?.maintenanceMessage || 'No message set'}"
                  </div>
                )}
              </div>
            </div>

            {/* API Orchestration */}
            <div className="glass-card p-8 rounded-[2.5rem] border border-slate-200/50 flex flex-col gap-8">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-indigo-50 rounded-2xl">
                    <Key className="h-5 w-5 text-indigo-600" />
                  </div>
                  <h3 className="font-manrope text-lg font-black uppercase tracking-tight">API Management</h3>
                </div>
                <Button variant="ghost" className="text-red-600 font-black uppercase tracking-widest text-[9px] hover:bg-red-50">Revoke All Keys</Button>
              </div>

              <div className="space-y-4">
                {[
                  { name: "Analytics API", key: "sk_live_••••••••34a1", lastUsed: "2 mins ago", status: "active" },
                  { name: "Webhook API", key: "sk_test_••••••••901b", lastUsed: "14 days ago", status: "inactive" }
                ].map((k, i) => (
                  <div key={i} className="group p-5 rounded-3xl border border-slate-100 hover:border-indigo-200 transition-all flex items-center justify-between bg-slate-50/30">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-colors">
                        <Database className="h-5 w-5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-800">{k.name}</span>
                        <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-tight">{k.key}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="hidden md:flex flex-col items-end">
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Last Ping</span>
                        <span className="text-[10px] font-bold text-slate-500">{k.lastUsed}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-9 w-9 rounded-xl hover:bg-indigo-50 text-slate-400 hover:text-indigo-600"
                          onClick={() => handleCopy(k.key)}
                        >
                          {copiedKey === k.key ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Button className="w-full h-12 bg-white border border-slate-200 hover:bg-slate-50 text-slate-900 font-black uppercase tracking-widest text-[10px] rounded-2xl">
                Generate New API Key
              </Button>
            </div>
            
            {/* System Purge (From Control Center) */}
            <div className="glass-card p-8 rounded-[2.5rem] border border-slate-200/50 flex flex-col gap-8">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-50 rounded-2xl">
                    <Zap className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-manrope text-xl font-black tracking-tight">System Purge</h3>
                    <p className="text-xs text-muted-foreground font-medium">Instantly flush infrastructure-level state.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button 
                    variant="outline" 
                    className="h-24 rounded-[2rem] border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 flex flex-col items-center justify-center gap-2 group transition-all"
                    onClick={() => {
                      if (confirm("Flush all Redis caches? This may cause temporary latency.")) {
                        actionMutation.mutate({ action: 'clear-cache' });
                      }
                    }}
                  >
                    <RefreshCw className="h-5 w-5 text-blue-600 group-hover:rotate-180 transition-transform duration-500" />
                    <span className="font-black tracking-widest text-[9px] uppercase">Flush Global Redis</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    disabled
                    className="h-24 rounded-[2rem] border-slate-200 opacity-50 flex flex-col items-center justify-center gap-2"
                  >
                    <Save className="h-5 w-5 text-slate-400" />
                    <span className="font-black tracking-widest text-[9px] uppercase">Re-Index Search</span>
                  </Button>
                </div>
            </div>
          </div>

          {/* Right Column: Security & Notifications */}
          <div className="lg:col-span-5 space-y-8">
            {/* Access Control & Lockdown */}
            <div className="glass-card p-8 rounded-[2.5rem] border border-slate-200/50 flex flex-col gap-8">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-50 rounded-2xl">
                  <Lock className="h-5 w-5 text-amber-600" />
                </div>
                <h3 className="font-manrope text-lg font-black uppercase tracking-tight">Security Hardening</h3>
              </div>

              <div className="space-y-6">
                {[
                  { label: "MFA Enforcement", icon: ShieldCheck, status: "Mandatory", active: true },
                  { label: "SSO (SAML/OAuth)", icon: Key, status: "Verified", active: true },
                  { label: "IP Restriction", icon: Globe, status: "Configurable", active: false }
                ].map((s, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <s.icon className="h-4 w-4 text-slate-400" />
                      <span className="text-sm font-bold text-slate-700">{s.label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-slate-200">{s.status}</Badge>
                      <Switch checked={s.active} className="data-[state=checked]:bg-emerald-600" />
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Emergency Lockdown */}
              <div className="pt-6 border-t border-slate-100">
                <div className={cn(
                    "p-6 rounded-[2rem] border transition-all duration-500",
                    snapshot?.systemStatus?.maintenanceMode && snapshot?.systemStatus?.maintenanceMessage?.includes('CRITICAL') ? "bg-red-900/10 border-red-500 shadow-lg shadow-red-500/10" : "bg-white border-slate-200"
                )}>
                    <div className="flex justify-between items-start mb-6">
                    <div className="flex flex-col gap-1">
                        <span className="font-black tracking-widest text-[10px] uppercase text-red-600">Emergency Lockdown</span>
                        <p className="text-xs font-medium leading-relaxed">Kill all sessions and freeze operations.</p>
                    </div>
                    <Switch 
                        checked={snapshot?.systemStatus?.maintenanceMode && snapshot?.systemStatus?.maintenanceMessage?.includes('CRITICAL')} 
                        onCheckedChange={handleToggleLockdown}
                        className="data-[state=checked]:bg-red-900"
                    />
                    </div>
                    {snapshot?.systemStatus?.maintenanceMode && snapshot?.systemStatus?.maintenanceMessage?.includes('CRITICAL') && (
                    <Badge variant="outline" className="text-[8px] font-black tracking-widest uppercase border-red-200 bg-red-50 text-red-600">Protocol Active</Badge>
                    )}
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Default Provisioning Role</Label>
                <select className="w-full h-12 px-4 bg-slate-50 border-none rounded-2xl text-[11px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-emerald-500/10">
                  <option>Standard Contributor</option>
                  <option>Regional Manager</option>
                  <option>Audit Specialist</option>
                </select>
              </div>
            </div>

            {/* Notification Pulse */}
            <div className="glass-card p-8 rounded-[2.5rem] border border-slate-200/50 flex flex-col gap-8">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-50 rounded-2xl">
                  <Bell className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="font-manrope text-lg font-black uppercase tracking-tight">Notification Pulse</h3>
              </div>

              <div className="space-y-4">
                {[
                  { label: "System Email Ledger", icon: Mail, active: true },
                  { label: "Hash Sync Integration", icon: Hash, active: true },
                  { label: "Critical SMS Broadcast", icon: MessageSquare, active: false }
                ].map((n, i) => (
                  <div key={i} className="p-4 rounded-2xl bg-slate-50/50 border border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <n.icon className="h-4 w-4 text-slate-400" />
                      <span className="text-xs font-black uppercase tracking-tight text-slate-700">{n.label}</span>
                    </div>
                    <Switch checked={n.active} className="data-[state=checked]:bg-emerald-600" />
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Primary Alert Recipients</Label>
                <div className="flex flex-wrap gap-2">
                  {['admin@emerald.io', 'security@emerald.io'].map((email) => (
                    <Badge key={email} className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-100 px-3 py-1.5 rounded-xl font-bold text-[10px] gap-2">
                      {email} <XCircle className="h-3 w-3 cursor-pointer opacity-50 hover:opacity-100" />
                    </Badge>
                  ))}
                  <Button variant="ghost" className="h-8 rounded-xl font-black uppercase tracking-widest text-[9px] gap-2 border border-dashed border-slate-200 px-4">
                    <Plus className="h-3 w-3" /> Register Email
                  </Button>
                </div>
              </div>
            </div>
            
            <div className="p-6 bg-amber-50/50 border border-amber-100 rounded-[2.5rem] flex gap-4 items-start">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="font-bold text-xs text-amber-900">Important Warning</span>
                <p className="text-[10px] text-amber-800/80 font-medium leading-relaxed">
                  Enabling maintenance mode will disconnect all active user sessions and prevent new logins. 
                  Superadmins will retain access via the `/auth/admin` bypass.
                </p>
              </div>
            </div>
          </div>
          
          {/* Global Broadcast (Full Width Bottom) */}
          <div className="col-span-1 lg:col-span-12">
            <div className="glass-card p-8 rounded-[3rem] border border-slate-200/50 flex flex-col md:flex-row gap-8 bg-gradient-to-br from-white to-slate-50">
                <div className="flex-1 space-y-8">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-50 rounded-2xl">
                            <Megaphone className="h-6 w-6 text-indigo-600" />
                        </div>
                        <div>
                            <h3 className="font-manrope text-xl font-black tracking-tight">Global Broadcast</h3>
                            <p className="text-xs text-muted-foreground font-medium">Send a real-time notice to all users.</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="font-black tracking-widest text-[9px] uppercase text-muted-foreground ml-1">Notice Level</label>
                            <div className="flex gap-2">
                                {(['info', 'warning', 'critical'] as const).map(level => (
                                <Button
                                    key={level}
                                    variant={broadcast.level === level ? 'default' : 'outline'}
                                    className={cn(
                                    "flex-1 rounded-xl h-10 font-black tracking-widest text-[9px] uppercase transition-all",
                                    broadcast.level === level && level === 'info' && "bg-blue-600 shadow-lg shadow-blue-500/20",
                                    broadcast.level === level && level === 'warning' && "bg-amber-600 shadow-lg shadow-amber-500/20",
                                    broadcast.level === level && level === 'critical' && "bg-red-600 shadow-lg shadow-red-500/20"
                                    )}
                                    onClick={() => setBroadcast({ ...broadcast, level })}
                                >
                                    {level}
                                </Button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="font-black tracking-widest text-[9px] uppercase text-muted-foreground ml-1">Title</label>
                            <Input 
                                placeholder="System Maintenance Scheduled..." 
                                className="rounded-2xl h-12 bg-white/50 border-slate-200 focus:ring-indigo-500/20 text-sm"
                                value={broadcast.title}
                                onChange={e => setBroadcast({ ...broadcast, title: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="font-black tracking-widest text-[9px] uppercase text-muted-foreground ml-1">Message Content</label>
                            <Textarea 
                                placeholder="The platform will be down for 15 minutes starting at 02:00 UTC." 
                                className="rounded-3xl min-h-[150px] bg-white/50 border-slate-200 focus:ring-indigo-500/20 text-sm p-5 leading-relaxed"
                                value={broadcast.message}
                                onChange={e => setBroadcast({ ...broadcast, message: e.target.value })}
                            />
                        </div>

                        <Button 
                            className="w-full md:w-auto h-14 px-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[1.5rem] font-black tracking-widest uppercase shadow-xl shadow-indigo-500/20 group transition-all"
                            onClick={handleBroadcast}
                            disabled={actionMutation.isPending}
                        >
                            <Megaphone className={cn("h-4 w-4 mr-2 transition-transform group-hover:scale-110 group-hover:-rotate-12", actionMutation.isPending && "animate-pulse")} />
                            Send Global Broadcast
                        </Button>
                    </div>
                </div>
                
                {/* Broadcast Preview */}
                <div className="flex-1 md:max-w-md pt-8 md:pt-0 md:border-l md:border-slate-200 md:pl-8 flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-3">
                        <Info className="h-3 w-3 text-slate-400" />
                        <span className="font-black tracking-widest text-[8px] uppercase text-slate-400">Preview Notice</span>
                    </div>
                    <div className={cn(
                        "p-4 rounded-2xl border flex gap-4 items-start bg-white shadow-sm",
                        broadcast.level === 'info' ? "border-blue-100" : broadcast.level === 'warning' ? "border-amber-100" : "border-red-100"
                    )}>
                        <div className={cn(
                        "p-2 rounded-xl shrink-0",
                        broadcast.level === 'info' ? "bg-blue-50 text-blue-600" : broadcast.level === 'warning' ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600"
                        )}>
                        <MessageSquare className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col gap-1 overflow-hidden w-full">
                        <span className="font-bold text-xs">{broadcast.title || 'Broadcast Title'}</span>
                        <p className="text-[10px] text-muted-foreground font-medium w-full whitespace-pre-wrap break-words">{broadcast.message || 'The content of your broadcast will appear here...'}</p>
                        </div>
                    </div>
                </div>
            </div>
          </div>
          
        </div>
      </div>
  );
}
