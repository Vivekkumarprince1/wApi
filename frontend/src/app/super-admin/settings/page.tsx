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
  Hash
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

  const { data: settings, isLoading } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: async () => {
      const response = await apiClient.get('/super-admin/settings');
      return response?.data || response || {};
    },
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

  const handleCopy = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
    toast.success("API Key copied to clipboard");
  };

  return (
      <div className="flex flex-col gap-8 pb-20 max-w-[1600px] mx-auto p-4 md:p-8 font-inter">
        <SuperAdminPageHeader
          icon={Settings}
          eyebrow="Governance"
          title="System Settings"
          subtitle="Configure platform-wide settings, security policies, and integration parameters."
          actions={(
            <Button 
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-xl shadow-emerald-500/20 h-12 px-8 rounded-2xl flex items-center gap-2 group"
              onClick={() => updateMutation.mutate({})}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span className="text-[10px] uppercase tracking-widest">Commit Changes</span>
            </Button>
          )}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Platform Config */}
          <div className="lg:col-span-7 space-y-8">
            <div className="glass-card p-8 rounded-[2.5rem] border border-slate-200/50 flex flex-col gap-8">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-50 rounded-2xl">
                  <Globe className="h-5 w-5 text-emerald-600" />
                </div>
                <h3 className="font-manrope text-lg font-black uppercase tracking-tight">System Configuration</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Enterprise Name</Label>
                  <Input 
                    defaultValue="Emerald Enterprise Solutions" 
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

              <div className="p-6 rounded-3xl bg-emerald-50/50 border border-emerald-100 flex items-center justify-between">
                <div className="space-y-1">
                  <h4 className="text-sm font-black text-emerald-900 uppercase tracking-tight">Maintenance Protocol</h4>
                  <p className="text-[11px] text-emerald-700/70 font-medium">Enable maintenance mode to restrict access for system updates.</p>
                </div>
                <Switch className="data-[state=checked]:bg-emerald-600" />
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
          </div>

          {/* Right Column: Security & Notifications */}
          <div className="lg:col-span-5 space-y-8">
            {/* Access Control */}
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
          </div>
        </div>
      </div>
  );
}
