"use client";

import React, { useState } from 'react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { toast } from 'sonner';
import { 
  Terminal, 
  Webhook, 
  Key, 
  Link as LinkIcon, 
  Copy, 
  RotateCw, 
  CheckCircle2, 
  Send, 
  ArrowRight,
  BookOpen,
  Code2,
  ShieldCheck,
  ShieldAlert,
  Zap
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import SuperAdminPageHeader from '@/components/super-admin/super-admin-page-header';
import { cn } from '@/lib/utils';

export default function BSPDeveloperPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showSecret, setShowSecret] = useState(false);

  const { data: configRes, isLoading: configLoading } = useQuery({
    queryKey: ['super-admin', 'bsp-dev-config'],
    queryFn: () => apiClient.get('/super-admin/gupshup/developer-config'), 
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => apiClient.patch('/super-admin/gupshup/developer-config', data),
    onSuccess: () => {
      toast.success('Developer configuration synchronized');
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'bsp-dev-config'] });
    },
    onError: (error: any) => toast.error(error?.message || 'Failed to update configuration'),
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-10 pb-20 font-inter">
        <SuperAdminPageHeader
          icon={Terminal}
          eyebrow="Developer Experience"
          title="BSP Onboarding"
          subtitle="Configure API access, webhook events, and test your connection to finalize the BSP integration process."
          actions={(
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="h-12 rounded-2xl px-6 border-slate-200 font-black uppercase tracking-widest text-[10px]"
                onClick={() => queryClient.invalidateQueries({ queryKey: ['super-admin', 'bsp-dev-config'] })}
              >
                <RotateCw className="h-4 w-4 mr-2" /> Reset View
              </Button>
              <Button
                className="h-12 rounded-2xl px-8 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-[10px] shadow-xl shadow-emerald-500/20"
                onClick={() => saveMutation.mutate({})}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? 'Saving' : 'Save Config'} <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}
        />

        {/* Setup Progress */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="md:col-span-3 glass-card p-8 rounded-[2.5rem] border border-emerald-500/10 bg-emerald-500/[0.02] relative overflow-hidden">
              <div className="absolute right-0 top-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <h3 className="font-manrope text-lg font-black uppercase tracking-tight mb-6 flex items-center gap-2">
                <Zap className="h-5 w-5 text-emerald-600" /> Setup Progress
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
                 {[
                   { title: 'API Key Generated', desc: 'Live key created on Oct 24, 2024.', status: 'complete' },
                   { title: 'IP Whitelist Sync', desc: '203.0.113.45, 198.51.100.2 active.', status: 'complete' },
                   { title: 'Test Connection', desc: 'Awaiting successful webhook receipt.', status: 'pending' }
                 ].map((step, i) => (
                   <div key={i} className={cn("p-6 rounded-[2rem] border transition-all", step.status === 'complete' ? "bg-white border-emerald-500/20 shadow-sm" : "bg-slate-50 border-slate-200/50")}>
                      <div className="flex items-start gap-4">
                         <div className={cn("h-10 w-10 rounded-2xl flex items-center justify-center shrink-0", step.status === 'complete' ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20" : "bg-slate-200 text-slate-400 font-black text-xs")}>
                            {step.status === 'complete' ? <CheckCircle2 className="h-5 w-5" /> : (i + 1)}
                         </div>
                         <div className="flex flex-col gap-1">
                            <span className="text-xs font-black uppercase tracking-tight">{step.title}</span>
                            <span className="text-[10px] font-medium text-muted-foreground leading-relaxed">{step.desc}</span>
                            {step.status === 'pending' && (
                              <button className="mt-2 text-[10px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-1 hover:gap-2 transition-all">
                                Send Test Event <ArrowRight className="h-3 w-3" />
                              </button>
                            )}
                         </div>
                      </div>
                   </div>
                 ))}
              </div>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
           {/* Webhook Configuration */}
           <div className="lg:col-span-8">
              <Card className="border-none ring-1 ring-slate-200/50 bg-white/50 backdrop-blur-3xl shadow-xl rounded-[2.5rem] overflow-hidden">
                <CardHeader className="p-8 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                        <Webhook className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="font-manrope text-lg font-black uppercase tracking-tight">Webhook Configuration</CardTitle>
                        <CardDescription className="text-[10px] font-black uppercase tracking-widest opacity-60">Endpoint orchestration and event streaming</CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 px-3 py-1 font-black text-[9px] uppercase tracking-widest">
                       Active
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-8 pt-4 space-y-8">
                   <div className="space-y-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Endpoint URL</Label>
                        <div className="relative group">
                          <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-emerald-600 transition-colors" />
                          <Input className="h-12 pl-11 bg-white border-slate-200 rounded-xl font-mono text-xs font-bold" defaultValue="https://api.partner-bsp.com/v1/webhooks/inbound" />
                        </div>
                      </div>

                      <div className="space-y-2">
                         <div className="flex justify-between items-center px-1">
                            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Signing Secret</Label>
                            <button className="text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:underline flex items-center gap-1.5">
                               <RotateCw className="h-3 w-3" /> Rotate Secret
                            </button>
                         </div>
                         <div className="flex gap-2">
                            <div className="relative flex-1">
                              <Input 
                                type={showSecret ? "text" : "password"} 
                                className="h-12 bg-slate-50 border-slate-200 rounded-xl font-mono text-xs font-bold" 
                                defaultValue="whsec_8f92a4b8e7d2c1f5a6b7c8d9e0f1a2b3" 
                                readOnly 
                              />
                            </div>
                            <Button variant="outline" className="h-12 w-12 rounded-xl border-slate-200" onClick={() => setShowSecret(!showSecret)}>
                               <Key className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" className="h-12 w-12 rounded-xl border-slate-200" onClick={() => copyToClipboard("whsec_8f92a4b8e7d2c1f5a6b7c8d9e0f1a2b3")}>
                               <Copy className="h-4 w-4" />
                            </Button>
                         </div>
                         <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight px-1">Used to verify that webhook requests originate from wApi infrastructure.</p>
                      </div>
                   </div>

                   <div className="h-px bg-slate-100 w-full" />

                   <div className="space-y-4">
                      <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-1">Event Subscriptions</Label>
                      <div className="flex flex-wrap gap-3">
                         {[
                           { id: 'recv', label: 'message.received', active: true },
                           { id: 'deliv', label: 'message.delivered', active: true },
                           { id: 'fail', label: 'message.failed', active: false },
                           { id: 'upd', label: 'status.updated', active: false },
                           { id: 'bill', label: 'billing.threshold_reached', active: false }
                         ].map((event) => (
                           <div key={event.id} className={cn(
                             "flex items-center gap-2 px-4 py-2 rounded-full border transition-all cursor-pointer",
                             event.active ? "bg-emerald-600/10 border-emerald-600/20 text-emerald-700" : "bg-white border-slate-200 text-muted-foreground hover:border-slate-300"
                           )}>
                              <Checkbox checked={event.active} className="border-emerald-600/20" />
                              <span className="text-[10px] font-black font-mono">{event.label}</span>
                           </div>
                         ))}
                      </div>
                   </div>
                </CardContent>
              </Card>
           </div>

           {/* Resources */}
           <div className="lg:col-span-4 space-y-8">
              <Card className="border-none ring-1 ring-slate-200/50 bg-white/50 backdrop-blur-3xl shadow-xl rounded-[2.5rem] overflow-hidden">
                <CardHeader className="p-8 pb-4">
                  <CardTitle className="font-manrope text-sm font-black uppercase tracking-tight">Developer Resources</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-2">
                   {[
                     { title: 'API Reference', desc: 'Endpoints, methods & schemas', icon: Code2 },
                     { title: 'Auth Guide', desc: 'Managing keys & OAuth flows', icon: ShieldCheck },
                     { title: 'Webhook Payloads', desc: 'JSON structures & examples', icon: Terminal }
                   ].map((res, i) => (
                     <div key={i} className="flex items-center justify-between p-4 rounded-2xl hover:bg-slate-50 transition-all group cursor-pointer border border-transparent hover:border-slate-100">
                        <div className="flex items-center gap-4">
                           <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                              <res.icon className="h-5 w-5" />
                           </div>
                           <div className="flex flex-col">
                              <span className="text-[11px] font-black uppercase tracking-widest">{res.title}</span>
                              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight">{res.desc}</span>
                           </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
                     </div>
                   ))}
                </CardContent>
              </Card>

              {/* Support Banner */}
              <div className="glass-card p-6 rounded-[2rem] border border-amber-500/10 bg-amber-500/[0.02] flex items-start gap-4">
                 <div className="h-10 w-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0">
                    <ShieldAlert className="h-5 w-5" />
                 </div>
                 <div className="flex flex-col gap-1">
                    <span className="text-xs font-black uppercase tracking-tight">Technical Support</span>
                    <p className="text-[10px] font-medium text-muted-foreground leading-relaxed">Our integration engineers are available via the emergency gateway for active BSP onboarding.</p>
                    <button className="mt-2 text-[10px] font-black uppercase tracking-widest text-amber-600 hover:underline">Open Support Tunnel</button>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
