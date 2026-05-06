"use client";

import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Megaphone, 
  Activity, 
  Settings, 
  RefreshCw, 
  Save, 
  AlertCircle,
  MessageSquare,
  Zap,
  Info
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import SuperAdminPageHeader from '@/components/super-admin/super-admin-page-header';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function ControlCenterPage() {
  const queryClient = useQueryClient();
  const [broadcast, setBroadcast] = useState({ title: '', message: '', level: 'info' as const });

  const { data: snapshot, isLoading } = useQuery({
    queryKey: ['admin', 'control-plane'],
    queryFn: async () => {
      const resp = await apiClient.get('/super-admin/control-plane');
      return resp.data.snapshot;
    }
  });

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

  return (
    <div className="flex flex-col gap-8 pb-20 max-w-[1400px] mx-auto p-4 md:p-8 font-inter animate-in fade-in duration-700">
      <SuperAdminPageHeader
        icon={ShieldAlert}
        eyebrow="Nerve Center"
        title="Global Control Plane"
        subtitle="Execute high-level administrative actions, manage platform availability, and broadcast system-wide notices."
        actions={(
          <Button 
            variant="outline" 
            className="rounded-2xl border-slate-200 hover:bg-slate-50 font-black tracking-widest text-[10px] uppercase h-12 px-6"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['admin', 'control-plane'] })}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
            Sync State
          </Button>
        )}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Availability & Lockdown */}
        <div className="lg:col-span-7 space-y-8">
          <div className="glass-card p-8 rounded-[3rem] border border-slate-200/50 flex flex-col gap-8 shadow-2xl shadow-slate-200/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-50 rounded-2xl">
                  <Activity className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h3 className="font-manrope text-xl font-black tracking-tight">Platform Availability</h3>
                  <p className="text-xs text-muted-foreground font-medium">Control public access to the entire wApi platform.</p>
                </div>
              </div>
              <Badge className={cn(
                "font-black tracking-widest text-[10px] uppercase px-4 py-1.5 rounded-full border-none shadow-sm",
                snapshot?.systemStatus?.maintenanceMode ? "bg-red-500 text-white animate-pulse" : "bg-emerald-500 text-white"
              )}>
                {snapshot?.systemStatus?.maintenanceMode ? 'Maintenance Active' : 'Live & Operational'}
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className={cn(
                "p-6 rounded-[2rem] border transition-all duration-500",
                snapshot?.systemStatus?.maintenanceMode ? "bg-red-50/50 border-red-200" : "bg-white border-slate-200"
              )}>
                <div className="flex justify-between items-start mb-6">
                  <div className="flex flex-col gap-1">
                    <span className="font-black tracking-widest text-[10px] uppercase text-muted-foreground">Maintenance Mode</span>
                    <p className="text-xs font-medium leading-relaxed">Block all non-admin access instantly.</p>
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

              <div className={cn(
                "p-6 rounded-[2rem] border transition-all duration-500",
                snapshot?.systemStatus?.maintenanceMode && snapshot?.systemStatus?.maintenanceMessage?.includes('CRITICAL') ? "bg-red-900/10 border-red-500 shadow-lg shadow-red-500/10" : "bg-white border-slate-200"
              )}>
                <div className="flex justify-between items-start mb-6">
                  <div className="flex flex-col gap-1">
                    <span className="font-black tracking-widest text-[10px] uppercase text-red-600">Emergency Lockdown</span>
                    <p className="text-xs font-medium leading-relaxed">Kill all sessions and freeze platform operations.</p>
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

            <div className="p-6 bg-amber-50/50 border border-amber-100 rounded-[2rem] flex gap-4 items-start">
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

          <div className="glass-card p-8 rounded-[3rem] border border-slate-200/50 flex flex-col gap-8">
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

        {/* Global Broadcast */}
        <div className="lg:col-span-5">
          <div className="glass-card p-8 rounded-[3rem] border border-slate-200/50 flex flex-col gap-8 bg-gradient-to-br from-white to-slate-50 sticky top-8">
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
                className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[1.5rem] font-black tracking-widest uppercase shadow-xl shadow-indigo-500/20 group transition-all"
                onClick={handleBroadcast}
                disabled={actionMutation.isPending}
              >
                <Megaphone className={cn("h-4 w-4 mr-2 transition-transform group-hover:scale-110 group-hover:-rotate-12", actionMutation.isPending && "animate-pulse")} />
                Send Global Broadcast
              </Button>
            </div>

            <div className="pt-6 border-t border-slate-200">
              <div className="flex items-center gap-2 mb-3">
                <Info className="h-3 w-3 text-slate-400" />
                <span className="font-black tracking-widest text-[8px] uppercase text-slate-400">Preview Notice</span>
              </div>
              <div className={cn(
                "p-4 rounded-2xl border flex gap-4 items-start bg-white",
                broadcast.level === 'info' ? "border-blue-100" : broadcast.level === 'warning' ? "border-amber-100" : "border-red-100"
              )}>
                <div className={cn(
                  "p-2 rounded-xl shrink-0",
                  broadcast.level === 'info' ? "bg-blue-50 text-blue-600" : broadcast.level === 'warning' ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600"
                )}>
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div className="flex flex-col gap-1 overflow-hidden">
                  <span className="font-bold text-xs">{broadcast.title || 'Broadcast Title'}</span>
                  <p className="text-[10px] text-muted-foreground font-medium truncate">{broadcast.message || 'The content of your broadcast will appear here...'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
