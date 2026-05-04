"use client";

import React, { useState } from 'react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { toast } from 'sonner';
import { 
  Plus,
  ArrowLeft,
  Settings,
  FileText,
  CreditCard as Payments,
  CheckCircle2 as TaskAlt,
  Save,
  ChevronRight,
  Activity,
  Database,
  Globe,
  Lock,
  Zap,
  Trash2,
  CreditCard
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import SuperAdminPageHeader from '@/components/super-admin/super-admin-page-header';
import { cn } from '@/lib/utils';

export default function PlanConfigPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activePricingMode, setActivePricingMode] = useState<'usage' | 'flat'>('usage');

  const { data: planRes, isLoading: planLoading } = useQuery({
    queryKey: ['super-admin', 'plan-config'],
    queryFn: () => apiClient.get('/super-admin/plans/enterprise-plus'), // Mocking a specific plan edit
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => apiClient.patch('/super-admin/plans/enterprise-plus', data),
    onSuccess: () => {
      toast.success('Plan configuration synchronized across all regions');
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'plan-config'] });
    },
    onError: (error: any) => toast.error(error?.message || 'Failed to save configuration'),
  });

  return (
      <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-10 pb-20 font-inter">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
          <span className="cursor-pointer hover:text-emerald-600 transition-colors" onClick={() => router.push('/super-admin/billing')}>Billing & Plans</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-emerald-600">Enterprise Plus Config</span>
        </div>

        <SuperAdminPageHeader
          icon={Zap}
          eyebrow="Commercial Matrix"
          title="Plan Orchestration"
          subtitle="Configure pricing tiers, service entitlements, and volume thresholds for Enterprise Plus deployment."
          actions={(
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="h-12 rounded-2xl px-6 border-slate-200 font-black uppercase tracking-widest text-[10px]"
                onClick={() => router.back()}
              >
                Discard Changes
              </Button>
              <Button
                className="h-12 rounded-2xl px-8 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-[10px] shadow-xl shadow-emerald-500/20"
                onClick={() => saveMutation.mutate({})}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? 'Synchronizing' : 'Save Plan Matrix'} <Save className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}
        />

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          {/* Core Configuration */}
          <div className="xl:col-span-8 space-y-8">
            {/* General Identity */}
            <Card className="border-none ring-1 ring-slate-200/50 bg-white/50 backdrop-blur-3xl shadow-xl rounded-[2.5rem] overflow-hidden">
              <CardHeader className="p-8 pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                    <Settings className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="font-manrope text-lg font-black uppercase tracking-tight">General Identity</CardTitle>
                    <CardDescription className="text-[10px] font-black uppercase tracking-widest opacity-60">Core plan identifiers and description</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-8 pt-4 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Plan Display Name</Label>
                    <Input className="h-12 bg-white border-slate-200 rounded-xl font-bold px-4" defaultValue="Enterprise Plus Volume" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Internal Reference</Label>
                    <Input className="h-12 bg-slate-50 border-slate-200 rounded-xl font-mono text-xs font-bold" defaultValue="ENT-PL-V2-2024" readOnly />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Public Description</Label>
                    <Textarea 
                      className="min-h-[100px] bg-white border-slate-200 rounded-2xl font-medium p-4" 
                      defaultValue="High-volume messaging tier with dedicated infrastructure, strict SLAs, and prioritized 24/7 technical support."
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pricing Engine */}
            <Card className="border-none ring-1 ring-slate-200/50 bg-white/50 backdrop-blur-3xl shadow-xl rounded-[2.5rem] overflow-hidden">
              <CardHeader className="p-8 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="font-manrope text-lg font-black uppercase tracking-tight">Pricing Engine</CardTitle>
                      <CardDescription className="text-[10px] font-black uppercase tracking-widest opacity-60">Commercial logic and usage thresholds</CardDescription>
                    </div>
                  </div>
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button 
                      className={cn("px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all", activePricingMode === 'usage' ? "bg-white shadow-sm text-emerald-600" : "text-muted-foreground hover:text-foreground")}
                      onClick={() => setActivePricingMode('usage')}
                    >
                      Usage-Based
                    </button>
                    <button 
                      className={cn("px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all", activePricingMode === 'flat' ? "bg-white shadow-sm text-emerald-600" : "text-muted-foreground hover:text-foreground")}
                      onClick={() => setActivePricingMode('flat')}
                    >
                      Flat Tier
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-8 pt-4 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Base Monthly Fee (INR)</Label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">₹</span>
                      <Input className="h-12 pl-8 bg-white border-slate-200 rounded-xl font-bold" defaultValue="25000" type="number" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Included Volume</Label>
                    <Input className="h-12 bg-white border-slate-200 rounded-xl font-bold" defaultValue="500000" type="number" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Overage Rate (/msg)</Label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">₹</span>
                      <Input className="h-12 pl-8 bg-white border-slate-200 rounded-xl font-bold text-emerald-600" defaultValue="0.15" step="0.01" type="number" />
                    </div>
                  </div>
                </div>

                {/* Volume Tiers */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center px-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Volume Discount Tiers</span>
                    <Button variant="ghost" className="h-8 text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:bg-emerald-500/5">
                      <Plus className="h-3.5 w-3.5 mr-2" /> Add Matrix Tier
                    </Button>
                  </div>
                  <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white/30">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100">
                          <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Threshold From</th>
                          <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Threshold To</th>
                          <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Unit Rate</th>
                          <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-muted-foreground text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {[
                          { from: '500,001', to: '1,000,000', rate: '₹0.12' },
                          { from: '1,000,001', to: 'Unlimited', rate: '₹0.08' }
                        ].map((tier, i) => (
                          <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 font-mono text-[11px] font-bold">{tier.from}</td>
                            <td className="px-6 py-4 font-mono text-[11px] font-bold">{tier.to}</td>
                            <td className="px-6 py-4 font-mono text-[11px] font-black text-emerald-600">{tier.rate}</td>
                            <td className="px-6 py-4 text-right">
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-300 hover:text-destructive transition-colors">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Entitlements */}
          <div className="xl:col-span-4">
            <Card className="border-none ring-1 ring-slate-200/50 bg-white/50 backdrop-blur-3xl shadow-xl rounded-[2.5rem] overflow-hidden sticky top-8">
              <CardHeader className="p-8 pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                    <Lock className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="font-manrope text-lg font-black uppercase tracking-tight">Entitlements</CardTitle>
                    <CardDescription className="text-[10px] font-black uppercase tracking-widest opacity-60">Service feature flags</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-8 pt-4 space-y-8">
                {[
                  {
                    category: 'Routing & API',
                    items: [
                      { id: 'api', label: 'Full API Cluster Access', desc: 'REST, GraphQL, and Stream nodes', checked: true },
                      { id: 'webhooks', label: 'Advanced Webhooks', desc: 'Real-time delivery & error telemetry', checked: true }
                    ]
                  },
                  {
                    category: 'Infrastructure',
                    items: [
                      { id: 'ip', label: 'Dedicated IP Pool', desc: 'Isolated sender reputation', checked: true },
                      { id: 'domain', label: 'Custom Sub-domains', desc: 'White-labeled link wrapping', checked: true }
                    ]
                  },
                  {
                    category: 'Support & SLA',
                    items: [
                      { id: 'sla', label: 'Priority Support SLA', desc: '1-hour critical response window', checked: true, highlighted: true },
                      { id: 'csm', label: 'Dedicated Account Lead', desc: 'Quarterly review & growth strategy', checked: false }
                    ]
                  }
                ].map((cat, i) => (
                  <div key={i} className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground border-b border-slate-100 pb-2">{cat.category}</h4>
                    <div className="space-y-4">
                      {cat.items.map((item) => (
                        <div key={item.id} className="flex items-start gap-4 p-3 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100 group">
                          <Switch 
                            defaultChecked={item.checked} 
                            className="mt-1 data-[state=checked]:bg-emerald-600"
                          />
                          <div className="flex flex-col gap-0.5">
                            <span className={cn("text-xs font-black uppercase tracking-tight transition-colors", item.highlighted ? "text-emerald-600" : "text-foreground group-hover:text-emerald-600")}>
                              {item.label}
                            </span>
                            <span className="text-[10px] font-medium text-muted-foreground leading-relaxed">{item.desc}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="pt-4 border-t border-slate-100 mt-4">
                   <div className="bg-emerald-500/5 rounded-2xl p-4 border border-emerald-500/10">
                      <div className="flex items-center gap-2 mb-2">
                         <Activity className="h-3.5 w-3.5 text-emerald-600" />
                         <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Compliance Audit</span>
                      </div>
                      <p className="text-[9px] font-bold text-emerald-700/70 leading-relaxed uppercase tracking-tight">Changes to commercial tiers require secondary cryptographic approval from the CFO gateway.</p>
                   </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
  );
}
