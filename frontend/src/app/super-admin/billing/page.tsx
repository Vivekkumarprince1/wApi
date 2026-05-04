"use client";

import React, { useState } from 'react';
import DashboardLayout from "@/components/layout/dashboard-layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import SuperAdminPageHeader from '@/components/super-admin/super-admin-page-header';
import { 
  CreditCard, 
  TrendingUp, 
  ArrowUpRight,
  Download,
  Plus,
  Zap,
  CheckCircle2,
  Eye,
  Loader2,
  BarChart3,
  Filter,
  Package,
  Search,
  MoreVertical,
  Edit2,
  Trash2,
  RotateCcw,
  Activity,
  DollarSign,
  FileText
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import PlanEditorModal from '@/components/super-admin/PlanEditorModal';
import { toast } from 'sonner';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';

export default function BillingPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [search, setSearch] = useState("");

  // Fetch Billing Stats
  const { data: billingData, isLoading: isLoadingStats } = useQuery({
    queryKey: ['admin', 'billing-stats'],
    queryFn: async () => {
      const response = await apiClient.get('/super-admin/billing-stats');
      return response?.data || response || {};
    },
  });

  // Fetch Plans
  const { data: plans = [], isLoading: isLoadingPlans, refetch: refetchPlans } = useQuery<any[]>({
    queryKey: ['admin-plans'],
    queryFn: async () => {
      const response = await apiClient.get('/super-admin/plans');
      if (Array.isArray(response)) return response;
      if (Array.isArray(response?.data)) return response.data;
      return [];
    }
  });

  // Fetch Invoices
  const { data: invoices, isLoading: isLoadingInvoices } = useQuery({
    queryKey: ['admin', 'invoices'],
    queryFn: async () => {
      const response = await apiClient.get('/super-admin/invoices');
      return response?.data || response || [];
    },
  });

  // Mutation for status toggling
  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => 
      apiClient.patch(`/super-admin/plans/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
      toast.success('Plan status updated');
    },
    onError: () => toast.error('Failed to update plan status')
  });

  const handleEdit = (plan: any) => {
    setSelectedPlan(plan);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setSelectedPlan(null);
    setIsModalOpen(true);
  };

  const filteredPlans = plans.filter(p => 
    p.name?.toLowerCase().includes(search.toLowerCase()) || 
    p.slug?.toLowerCase().includes(search.toLowerCase())
  );

  const stats = billingData || {};

  return (
    <DashboardLayout>
      <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-10 pb-20">
        <SuperAdminPageHeader
          icon={CreditCard}
          eyebrow="Commercial Control"
          title="Billing & Plans"
          subtitle="Oversee global subscription health, manage pricing tiers, and audit platform revenue."
          actions={(
            <div className="flex items-center gap-3">
              <Button variant="outline" className="h-12 border-border/50 bg-background/50 backdrop-blur-sm px-6 rounded-2xl group transition-all hover:bg-muted" onClick={() => refetchPlans()}>
                <Loader2 className={`h-4 w-4 mr-2 ${isLoadingPlans ? 'animate-spin text-emerald-600' : 'text-muted-foreground group-hover:text-emerald-600'}`} />
                <span className="text-xs font-black uppercase tracking-widest">Sync Registry</span>
              </Button>
              <Button className="rounded-2xl h-12 px-8 bg-emerald-600 hover:bg-emerald-700 shadow-2xl shadow-emerald-500/20 font-black uppercase tracking-widest text-xs group" onClick={handleCreate}>
                <Plus className="mr-2 h-4 w-4 group-hover:rotate-90 transition-transform" /> Create Tier
              </Button>
            </div>
          )}
        />

        {/* Snapshot Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="border-none bg-emerald-500/[0.03] dark:bg-emerald-500/[0.05] ring-1 ring-emerald-500/20 shadow-xl rounded-[40px] overflow-hidden group hover:ring-emerald-500/40 transition-all duration-500">
                <CardContent className="p-8">
                    <div className="flex justify-between items-start mb-6">
                        <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                            <TrendingUp className="h-7 w-7" />
                        </div>
                        <Badge className="bg-emerald-500 text-white border-none font-black text-[10px] py-0.5 tracking-widest uppercase">Growth</Badge>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600/70">Gross Revenue</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-emerald-950 dark:text-emerald-50 tracking-tighter tabular-nums">
                              ₹{(stats.grossRevenue || 0).toLocaleString()}
                            </span>
                            <span className="text-xs font-bold text-emerald-500 flex items-center gap-0.5"><ArrowUpRight className="h-3 w-3" /> 12%</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-none bg-indigo-500/[0.03] dark:bg-indigo-500/[0.05] ring-1 ring-indigo-500/20 shadow-xl rounded-[40px] overflow-hidden group hover:ring-indigo-500/40 transition-all duration-500">
                <CardContent className="p-8">
                    <div className="flex justify-between items-start mb-6">
                        <div className="h-14 w-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 group-hover:scale-110 transition-transform">
                            <Zap className="h-7 w-7" />
                        </div>
                        <Badge className="bg-indigo-500 text-white border-none font-black text-[10px] py-0.5 tracking-widest uppercase">Subscribers</Badge>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600/70">Active Subscriptions</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-indigo-950 dark:text-indigo-50 tracking-tighter tabular-nums">
                              {(stats.activeSubs || 0).toLocaleString()}
                            </span>
                            <span className="text-xs font-bold text-indigo-500 flex items-center gap-0.5"><ArrowUpRight className="h-3 w-3" /> 8%</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-none bg-amber-500/[0.03] dark:bg-amber-500/[0.05] ring-1 ring-amber-500/20 shadow-xl rounded-[40px] overflow-hidden group hover:ring-amber-500/40 transition-all duration-500">
                <CardContent className="p-8">
                    <div className="flex justify-between items-start mb-6">
                        <div className="h-14 w-14 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform">
                            <Package className="h-7 w-7" />
                        </div>
                        <Badge className="bg-amber-500 text-white border-none font-black text-[10px] py-0.5 tracking-widest uppercase">Registry</Badge>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600/70">Plan Catalog</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-amber-950 dark:text-amber-50 tracking-tighter tabular-nums">
                              {plans.length}
                            </span>
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Active Tiers</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-none bg-slate-500/[0.03] dark:bg-slate-500/[0.05] ring-1 ring-slate-500/20 shadow-xl rounded-[40px] overflow-hidden group hover:ring-slate-500/40 transition-all duration-500">
                <CardContent className="p-8">
                    <div className="flex justify-between items-start mb-6">
                        <div className="h-14 w-14 rounded-2xl bg-slate-500/10 flex items-center justify-center text-slate-500 group-hover:scale-110 transition-transform">
                            <DollarSign className="h-7 w-7" />
                        </div>
                        <Badge className="bg-slate-500 text-white border-none font-black text-[10px] py-0.5 tracking-widest uppercase">Settlements</Badge>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600/70">Pending Payouts</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-slate-950 dark:text-slate-50 tracking-tighter tabular-nums">
                              ₹{(stats.pendingPayouts || 0).toLocaleString()}
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
          {/* Plan Management Section */}
          <div className="xl:col-span-2 space-y-8">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-2xl font-black tracking-tight uppercase">Subscription Catalog</h3>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Deploy and manage tiered access protocols.</p>
              </div>
              <div className="relative w-72">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Filter plans..." 
                  className="pl-10 h-11 rounded-xl bg-muted/20 border-border/50 text-xs font-bold"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {isLoadingPlans ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-64 rounded-[40px]" />
                ))
              ) : filteredPlans.map((plan) => (
                <Card key={plan._id} className={`border-none ring-1 transition-all duration-500 rounded-[40px] overflow-hidden shadow-2xl group ${plan.isActive ? 'ring-emerald-500/20 bg-background/60 hover:ring-emerald-500/40' : 'ring-border/40 bg-muted/20 opacity-80 grayscale'}`}>
                  <div className={`h-2 w-full ${plan.isActive ? 'bg-emerald-600 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-muted-foreground/30'}`} />
                  <CardContent className="p-8 space-y-6">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <h4 className="text-xl font-black tracking-tight uppercase group-hover:text-emerald-600 transition-colors">{plan.name}</h4>
                        <Badge variant="ghost" className="p-0 text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 italic">{plan.slug}</Badge>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="rounded-xl hover:bg-muted">
                            <MoreVertical className="h-5 w-5 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 border-none shadow-2xl bg-background/95 backdrop-blur-xl ring-1 ring-border/50">
                          <DropdownMenuItem onClick={() => handleEdit(plan)} className="rounded-xl font-black uppercase tracking-widest text-[9px] py-3 gap-3">
                            <Edit2 className="size-4 text-emerald-600" /> Edit Node
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleStatusMutation.mutate({ id: plan._id, isActive: !plan.isActive })} className="rounded-xl font-black uppercase tracking-widest text-[9px] py-3 gap-3">
                            <RotateCcw className="size-4 text-amber-500" /> {plan.isActive ? 'Suspend' : 'Activate'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black tracking-tighter tabular-nums">₹{(plan.monthlyBaseFeeCents / 100).toLocaleString()}</span>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">/mo</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 py-4 border-y border-border/10">
                      <div className="space-y-0.5">
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 italic">Quota</p>
                        <p className="text-sm font-black tabular-nums">{plan.limits?.maxContacts?.toLocaleString() || '∞'}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 italic">Features</p>
                        <p className="text-sm font-black tabular-nums">{plan.features?.length || 0}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                       <div className="flex items-center gap-2">
                          <Switch 
                            checked={plan.isActive}
                            onCheckedChange={() => toggleStatusMutation.mutate({ id: plan._id, isActive: !plan.isActive })}
                            className="scale-90"
                          />
                          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Active</span>
                       </div>
                       <Button variant="ghost" size="sm" onClick={() => handleEdit(plan)} className="rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500/10 hover:text-emerald-600 transition-all">
                         Configure node
                       </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Sidebar Audit / Invoice Log */}
          <div className="space-y-8">
            <div className="space-y-1">
                <h3 className="text-2xl font-black tracking-tight uppercase">Invoice Archive</h3>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Platform settlement history.</p>
            </div>
            
            <Card className="border-none ring-1 ring-border/40 bg-background/50 backdrop-blur-3xl rounded-[40px] shadow-2xl overflow-hidden">
                <div className="max-h-[600px] overflow-y-auto scrollbar-none">
                    {isLoadingInvoices ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="p-6 border-b border-border/40 space-y-2">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-3 w-48" />
                            </div>
                        ))
                    ) : invoices?.length === 0 ? (
                        <div className="p-20 text-center space-y-4">
                            <FileText className="h-10 w-10 text-muted-foreground/20 mx-auto" />
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest italic">No records found</p>
                        </div>
                    ) : invoices?.map((inv: any) => (
                        <div key={inv._id} className="p-6 border-b border-border/40 hover:bg-muted/30 transition-colors group">
                            <div className="flex justify-between items-start mb-2">
                                <p className="text-[10px] font-mono font-bold text-muted-foreground group-hover:text-emerald-600 transition-colors uppercase tracking-tight">#{inv.invoiceId || inv._id.slice(-8).toUpperCase()}</p>
                                <Badge variant="outline" className={cn(
                                    "font-black text-[8px] uppercase tracking-widest border-none px-2",
                                    inv.status === 'paid' ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
                                )}>
                                    {inv.status || 'SETTLED'}
                                </Badge>
                            </div>
                            <div className="flex justify-between items-end">
                                <div className="space-y-0.5">
                                    <p className="text-sm font-black uppercase tracking-tight">{inv.planName || 'Enterprise Node'}</p>
                                    <p className="text-[9px] font-medium text-muted-foreground">{new Date(inv.createdAt).toLocaleDateString()}</p>
                                </div>
                                <p className="text-lg font-black tracking-tighter">₹{(inv.amount || 0).toLocaleString()}</p>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-6 bg-muted/20 text-center">
                    <Button variant="ghost" className="w-full text-[10px] font-black uppercase tracking-widest hover:text-emerald-600">
                        View Full Ledger
                    </Button>
                </div>
            </Card>
          </div>
        </div>

        <PlanEditorModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          plan={selectedPlan} 
        />
      </div>
    </DashboardLayout>
  );
}
