"use client";

import React from 'react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { toast } from 'sonner';
import { Activity, ArrowRight, Fingerprint, Globe, Layers3, RefreshCw, ShieldAlert, Workflow } from 'lucide-react';
import { useRouter } from 'next/navigation';
import SuperAdminPageHeader from '@/components/super-admin/super-admin-page-header';

export default function GupshupControlPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: healthRes, isLoading: healthLoading } = useQuery({
    queryKey: ['super-admin', 'gupshup-health'],
    queryFn: () => apiClient.get('/super-admin/gupshup/health'),
  });

  const { data: requestsRes, isLoading: requestsLoading } = useQuery({
    queryKey: ['super-admin', 'whatsapp-requests'],
    queryFn: () => apiClient.get('/super-admin/whatsapp-requests?limit=8'),
  });

  const reconcileMutation = useMutation({
    mutationFn: () => apiClient.post('/super-admin/gupshup/dashboards/reconcile', {}),
    onSuccess: async (response: any) => {
      toast.success(response?.message || 'Gupshup apps reconciled');
      await queryClient.invalidateQueries({ queryKey: ['super-admin', 'gupshup-health'] });
      await queryClient.invalidateQueries({ queryKey: ['super-admin', 'whatsapp-requests'] });
    },
    onError: (error: any) => toast.error(error?.message || 'Reconcile failed'),
  });

  const health = (healthRes as any)?.data ?? healthRes ?? {};
  const requests = (requestsRes as any)?.data ?? [];

  const cards = [
    { label: 'Mapped Apps', value: health.mappedApps ?? 0, icon: Workflow, tone: 'text-emerald-500' },
    { label: 'Connected Workspaces', value: health.whatsappConnected ?? 0, icon: Globe, tone: 'text-emerald-600' },
    { label: 'Orphaned Links', value: health.orphanedMappings ?? 0, icon: ShieldAlert, tone: 'text-amber-500' },
    { label: 'Total Workspaces', value: health.totalWorkspaces ?? 0, icon: Layers3, tone: 'text-emerald-600' },
  ];

  return (
      <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-10 pb-20">
        <SuperAdminPageHeader
          icon={Fingerprint}
          eyebrow="BSP Provider"
          title="Provider Operations"
          subtitle="Monitor partner health, app mappings, onboarding drift, and provisioning reliability across connected workspaces."
          actions={(
            <>
              <Button
                variant="outline"
                className="h-12 rounded-2xl px-6 border-border/50 font-black uppercase tracking-widest text-[10px]"
                onClick={() => queryClient.invalidateQueries({ queryKey: ['super-admin', 'gupshup-health'] })}
              >
                <RefreshCw className="h-4 w-4 mr-2" /> Refresh Snapshot
              </Button>
              <Button
                className="h-12 rounded-2xl px-8 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-[10px]"
                onClick={() => reconcileMutation.mutate()}
                disabled={reconcileMutation.isPending}
              >
                {reconcileMutation.isPending ? 'Reconciling' : 'Reconcile Mapping'} <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {cards.map((card) => (
            <Card key={card.label} className="border-none bg-background/50 backdrop-blur-3xl ring-1 ring-border/50 shadow-2xl rounded-[32px] overflow-hidden">
              <CardContent className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className={`h-12 w-12 rounded-2xl bg-muted/40 flex items-center justify-center ${card.tone}`}>
                    <card.icon className="h-6 w-6" />
                  </div>
                  <Badge variant="secondary" className="text-[10px] font-black uppercase tracking-widest">Live</Badge>
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">{card.label}</p>
                <div className="text-3xl font-black tracking-tighter tabular-nums mt-1">{card.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <Card className="xl:col-span-2 border-none ring-1 ring-border/50 bg-background/50 backdrop-blur-3xl shadow-2xl rounded-[40px] overflow-hidden">
            <CardHeader className="p-8 border-b border-border/10">
                <CardTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
                  <Activity className="h-5 w-5 text-emerald-600" /> BSP Request Queue
              </CardTitle>
              <CardDescription className="text-xs font-bold uppercase tracking-widest opacity-60">Latest WABA and Embedded Signup records.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/10">
                {requestsLoading ? Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="p-6 grid grid-cols-4 gap-4">
                    <Skeleton className="h-10 w-full rounded-xl" />
                    <Skeleton className="h-10 w-full rounded-xl" />
                    <Skeleton className="h-10 w-full rounded-xl" />
                    <Skeleton className="h-10 w-full rounded-xl" />
                  </div>
                )) : requests.map((request: any) => (
                  <div key={request._id} className="p-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-center hover:bg-emerald-500/[0.02] transition-colors">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Workspace</p>
                      <p className="font-black uppercase tracking-tight">{request.workspaceName}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Business Id</p>
                      <p className="font-mono text-xs">{request.businessId}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Phone</p>
                      <p className="font-bold">{request.phoneNumber}</p>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <Badge variant="outline" className="bg-emerald-500/5 text-emerald-600 border-emerald-500/20 uppercase tracking-widest text-[10px] font-black">
                        {request.status}
                      </Badge>
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Inline</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-none ring-1 ring-border/50 bg-background/50 backdrop-blur-3xl shadow-2xl rounded-[40px] overflow-hidden">
            <CardHeader className="p-8 border-b border-border/10">
                <CardTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
                <ShieldAlert className="h-5 w-5 text-emerald-600" /> Provider Health
              </CardTitle>
              <CardDescription className="text-xs font-bold uppercase tracking-widest opacity-60">Partner state and mapping integrity.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-4">
              {healthLoading ? <Skeleton className="h-64 w-full rounded-3xl" /> : (
                <>
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/30">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Partner Status</span>
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 uppercase tracking-widest text-[10px] font-black">{health.status}</Badge>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/30">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Last Checked</span>
                    <span className="text-xs font-bold">{health.lastCheckedAt ? new Date(health.lastCheckedAt).toLocaleString() : 'Unknown'}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/30">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Orphaned Mappings</span>
                    <span className="text-xs font-black tabular-nums">{health.orphanedMappings ?? 0}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
  );
}
