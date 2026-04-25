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
  CreditCard, 
  TrendingUp, 
  ArrowUpRight,
  Download,
  Plus,
  Zap,
  ShieldCheck,
  Building2,
  PieChart,
  Calendar,
  CheckCircle2,
  XCircle,
  Eye,
  FileText,
  Loader2,
  MoreVertical,
  CircleDollarSign,
  BarChart3,
  Filter
} from "lucide-react";
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export default function BillingPage() {
  const { data: billingData, isLoading } = useQuery({
    queryKey: ['admin', 'billing'],
    queryFn: async () => {
      const response = await apiClient.get('/super-admin/billing-stats');
      return response?.data || response || {};
    },
  });

  const { data: invoices, isLoading: isLoadingInvoices } = useQuery({
    queryKey: ['admin', 'invoices'],
    queryFn: async () => {
      const response = await apiClient.get('/super-admin/invoices');
      return response?.data || response || [];
    },
  });

  const stats = billingData || {};
  const revenueStats = [
    { label: "Gross Revenue", value: `₹${(stats.grossRevenue || 428940).toLocaleString()}`, change: "+12.5%", icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Active Subs", value: (stats.activeSubs || 1284).toLocaleString(), change: "+8.2%", icon: Zap, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Churn Rate", value: `${(stats.churnRate || 1.4)}%`, change: "-0.5%", icon: BarChart3, color: "text-indigo-600", bg: "bg-indigo-50" },
    { label: "Pending Payouts", value: `₹${(stats.pendingPayouts || 12400).toLocaleString()}`, change: "+4.1%", icon: CircleDollarSign, color: "text-blue-600", bg: "bg-blue-50" },
  ];

  const plans = [
    { name: "Starter", price: "49", features: ["5 Projects", "Basic Analytics", "48h Support"], color: "border-slate-200", current: false },
    { name: "Pro", price: "199", features: ["Unlimited Projects", "AI Insights", "4h Priority Support", "Custom Integrations"], color: "border-emerald-500", current: true, popular: true },
    { name: "Enterprise", price: "999", features: ["Full Platform Access", "Account Manager", "99.9% SLA", "On-premise Options"], color: "border-slate-900", current: false },
  ];

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-8 pb-20 max-w-[1600px] mx-auto p-4 md:p-8 font-inter">
        <SuperAdminPageHeader
          icon={CreditCard}
          eyebrow="Commercial"
          title="Billing & Revenue"
          subtitle="Oversee global subscription health, fiscal cycles, and enterprise financial compliance."
          actions={(
            <div className="flex items-center gap-3">
              <Button variant="outline" className="h-12 px-6 rounded-2xl font-black uppercase tracking-widest text-[10px] border-slate-200">
                <Download className="h-4 w-4 mr-2" /> Financial Report
              </Button>
              <Button className="h-12 px-8 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-xl shadow-emerald-500/20">
                <Plus className="h-4 w-4 mr-2" /> New SKU
              </Button>
            </div>
          )}
        />

        {/* Commercial Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {revenueStats.map((stat, i) => (
            <div key={i} className="glass-card p-6 rounded-[2rem] border border-slate-200/50 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <div className={cn("p-3 rounded-2xl", stat.bg)}>
                  <stat.icon className={cn("h-5 w-5", stat.color)} />
                </div>
                <div className="flex flex-col items-end">
                   <span className={cn("text-[10px] font-black tracking-tighter", stat.change.startsWith('+') ? 'text-emerald-600' : 'text-red-600')}>{stat.change}</span>
                   <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">VS MTM</span>
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{stat.label}</span>
                <span className="text-3xl font-black font-manrope tracking-tight mt-1">{isLoading ? <Skeleton className="h-9 w-24" /> : stat.value}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Revenue Trends */}
          <div className="lg:col-span-2 glass-card p-8 rounded-[2.5rem] border border-slate-200/50 flex flex-col gap-8">
            <div className="flex justify-between items-center">
               <h3 className="font-manrope text-lg font-black uppercase tracking-tight flex items-center gap-2">
                 <TrendingUp className="h-5 w-5 text-emerald-600" /> Revenue Trajectory
               </h3>
               <select className="h-9 px-4 bg-slate-50 border-none rounded-xl text-[10px] font-black uppercase tracking-widest outline-none">
                 <option>Last 6 Quarters</option>
                 <option>Fiscal Year 2024</option>
               </select>
            </div>
            <div className="h-56 flex items-end gap-3 px-4">
              {[40, 65, 55, 85, 75, 95, 60, 70, 80, 90, 85, 100].map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center group">
                  <div 
                    className="w-full bg-emerald-500/10 hover:bg-emerald-500/30 rounded-t-lg transition-all cursor-help" 
                    style={{ height: `${h}%` }}
                    title={`Month ${i+1}: $${h*4}k`}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-muted-foreground pt-4 border-t border-slate-100">
               <span>Q1 2024</span>
               <span>Q2 2024</span>
               <span>Q3 2024</span>
            </div>
          </div>

          {/* Plan Cycles */}
          <div className="glass-card p-8 rounded-[2.5rem] border border-slate-200/50 flex flex-col gap-6">
            <h3 className="font-manrope text-lg font-black uppercase tracking-tight">Active Cycles</h3>
            <div className="space-y-6 flex-1">
              {[
                { name: "Enterprise Node", val: 42, color: "bg-emerald-600" },
                { name: "Professional Tier", val: 38, color: "bg-amber-500" },
                { name: "Starter Core", val: 20, color: "bg-slate-300" }
              ].map((p, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{p.name}</span>
                    <span className="text-xs font-black">{p.val}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all duration-1000", p.color)} style={{ width: `${p.val}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" className="w-full h-11 rounded-2xl font-black uppercase tracking-widest text-[10px] border-slate-200">
              Commercial Analytics
            </Button>
          </div>
        </div>

        {/* Subscription Matrix */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan, i) => (
            <div key={i} className={cn(
              "glass-card p-8 rounded-[2.5rem] border-2 transition-all hover:scale-[1.02] flex flex-col gap-6 relative overflow-hidden",
              plan.popular ? "border-emerald-500 shadow-2xl shadow-emerald-500/10 ring-8 ring-emerald-500/5" : "border-slate-200/50"
            )}>
              {plan.popular && (
                <div className="absolute top-4 right-[-35px] rotate-45 bg-emerald-600 text-white text-[8px] py-1.5 px-10 font-black uppercase tracking-widest shadow-sm">
                  Strategic
                </div>
              )}
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{plan.name} Tier</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black font-manrope tracking-tighter">${plan.price}</span>
                  <span className="text-xs font-bold text-muted-foreground">/mo</span>
                </div>
              </div>
              <ul className="space-y-4 flex-1">
                {plan.features.map((f, j) => (
                  <li key={j} className="flex items-center gap-3 text-xs font-bold text-slate-600">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button className={cn(
                "w-full h-12 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all",
                plan.current ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg" : "bg-white border-slate-200 text-slate-900 border"
              )}>
                {plan.current ? "Active Protocol" : "Upgrade Deployment"}
              </Button>
            </div>
          ))}
        </div>

        {/* Invoices */}
        <div className="glass-card rounded-[2.5rem] overflow-hidden shadow-sm border border-slate-200/50 flex flex-col">
          <div className="p-8 flex items-center justify-between border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-manrope text-lg font-black uppercase tracking-tight">Invoice Archive</h3>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="rounded-xl"><Filter className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="rounded-xl"><ArrowUpRight className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Identifier</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Settlement Date</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sku / Plan</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Fiscal Amount</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoadingInvoices ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-8 py-5"><Skeleton className="h-6 w-32" /></td>
                      <td className="px-8 py-5"><Skeleton className="h-6 w-24" /></td>
                      <td className="px-8 py-5"><Skeleton className="h-6 w-28" /></td>
                      <td className="px-8 py-5"><Skeleton className="h-6 w-20" /></td>
                      <td className="px-8 py-5"><Skeleton className="h-6 w-24 rounded-full" /></td>
                      <td className="px-8 py-5 text-right"><Skeleton className="h-8 w-16 ml-auto rounded-lg" /></td>
                    </tr>
                  ))
                ) : (invoices?.length === 0 || !invoices) ? (
                  <tr>
                    <td colSpan={6} className="px-8 py-20 text-center text-xs font-black text-muted-foreground uppercase tracking-widest">No transaction history found</td>
                  </tr>
                ) : invoices.map((inv: any) => (
                  <tr key={inv._id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-5 font-mono text-[11px] font-bold text-slate-500 uppercase tracking-tight">{inv.invoiceId || `INV-${inv._id.toString().slice(-8).toUpperCase()}`}</td>
                    <td className="px-8 py-5 text-xs font-bold">{new Date(inv.createdAt).toLocaleDateString()}</td>
                    <td className="px-8 py-5">
                       <span className="text-xs font-black text-emerald-600 uppercase tracking-widest">{inv.planName || 'Enterprise Pro'}</span>
                    </td>
                    <td className="px-8 py-5 font-black text-sm">${inv.amount?.toFixed(2) || '199.00'}</td>
                    <td className="px-8 py-5">
                      <Badge variant="outline" className={cn(
                        "font-black text-[9px] uppercase tracking-widest border-none px-3 py-1",
                        inv.status === 'paid' ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
                      )}>
                        {inv.status || 'Settled'}
                      </Badge>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-3">
                         <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-600 transition-all"><Eye className="h-4 w-4" /></Button>
                         <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-600 transition-all"><Download className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
