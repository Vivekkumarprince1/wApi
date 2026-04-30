"use client";

import React from 'react';
import DashboardLayout from "@/components/layout/dashboard-layout";
import { 
  Package, 
  Plus, 
  Search, 
  CreditCard, 
  CheckCircle2, 
  TrendingUp,
  AlertCircle,
  MoreVertical,
  Edit2,
  Trash2,
  RotateCcw,
  Zap,
  Layers,
  Shield,
  BarChart3,
  DollarSign,
  ArrowUpRight,
  Loader2,
  Settings,
  Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import SuperAdminPageHeader from '@/components/super-admin/super-admin-page-header';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import PlanEditorModal from '@/components/super-admin/PlanEditorModal';
import { toast } from 'sonner';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';

export default function EconomicControlPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [selectedPlan, setSelectedPlan] = React.useState<any>(null);
  const [search, setSearch] = React.useState("");

  const { data: plans = [], isLoading, error, refetch } = useQuery<any[]>({
    queryKey: ['admin-plans'],
    queryFn: async () => {
      const response = await apiClient.get('/super-admin/plans');
      if (Array.isArray(response)) return response;
      if (Array.isArray(response?.data)) return response.data;
      if (Array.isArray(response?.data?.data)) return response.data.data;
      return [];
    }
  });

  // Mutation for status toggling with Optimistic UI
  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => 
      apiClient.patch(`/super-admin/plans/${id}`, { isActive }),
    onMutate: async (newPlan) => {
      await queryClient.cancelQueries({ queryKey: ['admin-plans'] });
      const previousPlans = queryClient.getQueryData(['admin-plans']);
      queryClient.setQueryData(['admin-plans'], (old: any) => {
        const currentPlans = Array.isArray(old) ? old : Array.isArray(old?.data) ? old.data : [];
        return currentPlans.map((plan: any) => 
          plan._id === newPlan.id ? { ...plan, isActive: newPlan.isActive } : plan
        );
      });
      return { previousPlans };
    },
    onError: (err, newPlan, context: any) => {
      queryClient.setQueryData(['admin-plans'], context.previousPlans);
      toast.error('Sync failed. Reverting status change.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
    },
  });

  // Mutation for deletion
  const deletePlanMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/super-admin/plans/${id}`),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['admin-plans'] });
      const previousPlans = queryClient.getQueryData(['admin-plans']);
      queryClient.setQueryData(['admin-plans'], (old: any) => 
        (Array.isArray(old) ? old : Array.isArray(old?.data) ? old.data : []).filter((plan: any) => plan._id !== id)
      );
      return { previousPlans };
    },
    onError: (err, id, context: any) => {
      queryClient.setQueryData(['admin-plans'], context.previousPlans);
      toast.error('Termination failed. Restoring plan record.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
    },
  });

  const handleEdit = (plan: any) => {
    setSelectedPlan(plan);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setSelectedPlan(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('CRITICAL: DECOMMISSION PLAN\n\nThis action will permanently purge this plan from the platform ledger. Active subscribers may experience service interruptions. Proceed?')) return;
    deletePlanMutation.mutate(id);
    toast.success('Decommission sequence initiated');
  };

  const handleToggleStatus = (plan: any) => {
    toggleStatusMutation.mutate({ id: plan._id, isActive: !plan.isActive });
  };

  const filteredPlans = plans.filter(p => 
    p.name?.toLowerCase().includes(search.toLowerCase()) || 
    p.slug?.toLowerCase().includes(search.toLowerCase())
  );

  if (error) {
    return (
      <DashboardLayout>
        <div className="p-8 text-center min-h-[60vh] flex flex-col items-center justify-center">
            <div className="h-20 w-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="h-10 w-10 text-amber-500" />
            </div>
          <h2 className="text-2xl font-black uppercase text-amber-500">Protocol Violation</h2>
          <p className="text-muted-foreground font-medium mt-2">Economic control requires financial clearance.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-10 pb-20">
        <SuperAdminPageHeader
          icon={Package}
          eyebrow="Plan Management"
          title="Plan Management"
          subtitle="Create, compare, and govern subscription tiers with clear pricing, limits, and feature flags."
          actions={(
            <>
              <Button variant="outline" className="h-12 border-border/50 bg-background/50 backdrop-blur-sm px-6 rounded-2xl group transition-all hover:bg-muted" onClick={() => refetch()}>
                <Loader2 className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin text-emerald-600' : 'text-muted-foreground group-hover:text-emerald-600'}`} />
                <span className="text-xs font-black uppercase tracking-widest">Refresh Plans</span>
              </Button>
              <Button className="rounded-2xl h-12 px-8 bg-emerald-600 hover:bg-emerald-700 shadow-2xl shadow-emerald-500/20 font-black uppercase tracking-widest text-xs group" onClick={handleCreate}>
                <Plus className="mr-2 h-4 w-4 group-hover:rotate-90 transition-transform" /> New Plan
              </Button>
            </>
          )}
        />

        {/* Plan Snapshot */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="border-none bg-emerald-500/[0.03] dark:bg-emerald-500/[0.05] ring-1 ring-emerald-500/20 shadow-xl rounded-[40px] overflow-hidden group hover:ring-emerald-500/40 transition-all duration-500">
                <CardContent className="p-8">
                    <div className="flex justify-between items-start mb-6">
                        <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                            <BarChart3 className="h-7 w-7" />
                        </div>
                        <Badge className="bg-emerald-500 text-white border-none font-black text-[10px] py-0.5 tracking-widest uppercase">Target Meta</Badge>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600/70">Projected MRR</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-black text-emerald-950 dark:text-emerald-50 tracking-tighter tabular-nums">₹0.00</span>
                            <span className="text-xs font-bold text-emerald-500 flex items-center gap-0.5"><ArrowUpRight className="h-3 w-3" /> 0%</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
            <Card className="border-none bg-emerald-500/[0.03] dark:bg-emerald-500/[0.05] ring-1 ring-emerald-500/20 shadow-xl rounded-[40px] overflow-hidden group hover:ring-emerald-500/40 transition-all duration-500">
                <CardContent className="p-8">
                    <div className="flex justify-between items-start mb-6">
                        <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                            <CheckCircle2 className="h-7 w-7" />
                        </div>
                        <Badge className="bg-emerald-500 text-white border-none font-black text-[10px] py-0.5 tracking-widest uppercase">Healthy</Badge>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600/70">Deployments</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-black text-emerald-950 dark:text-emerald-50 tracking-tighter tabular-nums">{plans.length}</span>
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Active Tiers</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
            <Card className="border-none bg-amber-500/[0.03] dark:bg-amber-500/[0.05] ring-1 ring-amber-500/20 shadow-xl rounded-[40px] overflow-hidden group hover:ring-amber-500/40 transition-all duration-500">
                <CardContent className="p-8">
                    <div className="flex justify-between items-start mb-6">
                        <div className="h-14 w-14 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform">
                            <AlertCircle className="h-7 w-7" />
                        </div>
                        <Badge className="bg-amber-500 text-white border-none font-black text-[10px] py-0.5 tracking-widest uppercase">Monitor</Badge>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600/70">Feature Deviations</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-black text-amber-950 dark:text-amber-50 tracking-tighter tabular-nums">0</span>
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Legacy Nodes</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>

        {/* Plan Search */}
        <div className="flex flex-col md:flex-row items-center gap-4 bg-background/50 backdrop-blur-3xl p-3 rounded-[32px] border border-border/40 shadow-xl">
          <div className="relative flex-1 group w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-emerald-600 transition-colors" />
            <Input 
              placeholder="Filter plans by name or slug..." 
              className="pl-12 h-14 bg-transparent border-none focus-visible:ring-0 font-bold text-base placeholder:text-muted-foreground/40"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Plan Comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-8 text-white">
            {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                    <Card key={i} className="border-none ring-1 ring-border/10 bg-background/50 backdrop-blur-sm rounded-[40px] p-8 space-y-4">
                        <Skeleton className="h-10 w-48 rounded-2xl" />
                        <Skeleton className="h-6 w-32 rounded-xl" />
                        <div className="space-y-2 py-4">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-2/3" />
                        </div>
                        <Skeleton className="h-12 w-full rounded-2xl" />
                    </Card>
                ))
            ) : filteredPlans.length === 0 ? (
                <div className="col-span-full p-20 text-center">
                    <Package className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
                    <p className="text-muted-foreground font-black uppercase tracking-widest text-xs">No plans defined in the catalog.</p>
                </div>
            ) : (
                filteredPlans.map((plan) => (
                    <Card key={plan._id} className={`border-none ring-1 transition-all duration-500 rounded-[40px] overflow-hidden shadow-2xl group ${plan.isActive ? 'ring-emerald-500/20 bg-background/60 hover:ring-emerald-500/40' : 'ring-border/40 bg-muted/20 opacity-80 grayscale'}`}>
                      <div className={`h-2.5 w-full ${plan.isActive ? 'bg-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-muted-foreground/30'}`} />
                        <CardContent className="p-10 space-y-8">
                            <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-3xl font-black tracking-tight uppercase group-hover:text-emerald-600 transition-colors">{plan.name}</h3>
                                        {plan.isDefault && (
                                            <Badge className="bg-indigo-600 text-white border-none font-black text-[9px] px-3 rounded-full uppercase tracking-widest animate-pulse">Default</Badge>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="ghost" className="p-0 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{plan.slug}</Badge>
                                        <div className="h-px w-3 bg-border" />
                                        <span className="text-[10px] font-bold text-emerald-600 uppercase">Tier Node: {plan._id.toString().slice(-6).toUpperCase()}</span>
                                    </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="rounded-2xl hover:bg-muted transform transition-all active:scale-95">
                                            <MoreVertical className="h-6 w-6 text-muted-foreground" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-64 rounded-2xl p-2 border-none shadow-2xl bg-background/95 backdrop-blur-xl ring-1 ring-border/50">
                                        <DropdownMenuItem onClick={() => handleEdit(plan)} className="rounded-xl font-black uppercase tracking-widest text-[10px] py-4 gap-3">
                                            <Edit2 className="size-4 text-emerald-600" /> Edit Node Spec
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleToggleStatus(plan)} className="rounded-xl font-black uppercase tracking-widest text-[10px] py-4 gap-3">
                                            <RotateCcw className="size-4 text-amber-500" /> {plan.isActive ? 'Deactivate Node' : 'Activate Node'}
                                        </DropdownMenuItem>
                                        <div className="h-px bg-border/50 my-1" />
                                        <DropdownMenuItem onClick={() => handleDelete(plan._id)} className="rounded-xl font-black uppercase tracking-widest text-[10px] py-4 gap-3 text-red-500 focus:bg-red-50 focus:text-red-600">
                                            <Trash2 className="size-4" /> Purge Tier
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-black tracking-tighter tabular-nums">₹{(plan.monthlyBaseFeeCents / 100).toLocaleString()}</span>
                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">/ Month</span>
                                </div>
                                {plan.yearlyBaseFeeCents > 0 && (
                                    <div className="flex items-center gap-2">
                                        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-none font-black text-[10px] py-1 px-3 rounded-full uppercase tracking-widest italic">
                                            ₹{(plan.yearlyBaseFeeCents / 100).toLocaleString()} / Year
                                        </Badge>
                                        <span className="text-[10px] font-bold text-emerald-500 uppercase">Save ~{(1 - (plan.yearlyBaseFeeCents / (plan.monthlyBaseFeeCents * 12 || 1))) * 100 | 0}%</span>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4 py-6 border-y border-border/10">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Contacts Capacity</p>
                                    <p className="text-lg font-black tabular-nums">{plan.limits?.maxContacts?.toLocaleString() || '∞'}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Messages</p>
                                    <p className="text-lg font-black tabular-nums">{plan.limits?.maxMessagesPerMonth?.toLocaleString() || '∞'}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Automations</p>
                                    <p className="text-lg font-black tabular-nums">{plan.limits?.maxAutomations || '0'}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Templates</p>
                                    <p className="text-lg font-black tabular-nums">{plan.limits?.maxTemplates || '0'}</p>
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-6 pt-4">
                                <div className="flex items-center gap-3">
                                    <Switch 
                                        checked={plan.isActive} 
                                        onCheckedChange={() => handleToggleStatus(plan)}
                                        className="scale-110"
                                    />
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${plan.isActive ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                                        {plan.isActive ? 'Active Node' : 'Suspended'}
                                    </span>
                                </div>
                                <Button 
                                    className="rounded-xl h-12 flex-1 bg-muted hover:bg-muted/80 text-foreground font-black uppercase tracking-widest text-[10px] border border-border/10 shadow-sm"
                                    onClick={() => handleEdit(plan)}
                                >
                                    Modify Specifics
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))
            )}
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
