"use client";

import React from 'react';
import { 
  ShoppingBag, 
  Package, 
  ShoppingCart, 
  Bot, 
  Settings, 
  ArrowUpRight, 
  TrendingUp, 
  Users, 
  Globe, 
  Zap,
  ChevronRight,
  Sparkles,
  CreditCard,
  Truck,
  Plus,
  BarChart3
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import api from '@/lib/axios';
import FlashLoader from '@/components/ui/flash-loader';

export default function CommerceOverviewPage() {
  const router = useRouter();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['commerce-stats'],
    queryFn: async () => {
      // We'll simulate some stats for now or fetch from a real endpoint if available
      const response = await api.get('/commerce/stats').catch(() => ({ data: {
        totalSales: 0,
        orderCount: 0,
        activeProducts: 0,
        conversionRate: 0,
        recentOrders: []
      }}));
      return response.data;
    }
  });

  if (isLoading) return <FlashLoader />;

  const QUICK_LINKS = [
    {
      title: "Product Catalog",
      description: "Manage your inventory, pricing tiers, and global scaling.",
      icon: Package,
      path: "/commerce/catalog",
      color: "text-blue-500",
      bg: "bg-blue-500/5",
      border: "border-blue-500/10",
      stats: "In-Stock: --"
    },
    {
      title: "Sales Orders",
      description: "Monitor fulfillment, logistics, and payment confirmations.",
      icon: ShoppingCart,
      path: "/commerce/orders",
      color: "text-emerald-500",
      bg: "bg-emerald-500/5",
      border: "border-emerald-500/10",
      stats: "Pending: --"
    },
    {
      title: "Checkout Bot",
      description: "Configure your automated AI WhatsApp selling companion.",
      icon: Bot,
      path: "/commerce/checkout-bot",
      color: "text-purple-500",
      bg: "bg-purple-500/5",
      border: "border-purple-500/10",
      stats: "Active"
    },
    {
      title: "Store Settings",
      description: "Customize currency, taxes, and international shipping zones.",
      icon: Settings,
      path: "/commerce/settings",
      color: "text-slate-500",
      bg: "bg-slate-500/5",
      border: "border-slate-500/10",
      stats: "Global"
    }
  ];

  const StatCard = ({ label, value, icon: Icon, color, bg }: any) => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative group p-6 bg-card border border-border/40 rounded-[32px] shadow-premium-sm hover:shadow-premium hover:border-primary/20 transition-all overflow-hidden"
    >
      <div className="flex items-center justify-between mb-4">
         <div className={cn("p-2.5 rounded-xl", bg, color)}>
            <Icon className="size-5" />
         </div>
         <Badge variant="outline" className="rounded-lg text-[9px] font-black uppercase tracking-widest border-border/40 opacity-40">Live</Badge>
      </div>
      <div className="space-y-1">
         <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60 leading-none">{label}</p>
         <h3 className="text-3xl font-black tracking-tight">{value}</h3>
      </div>
      {/* Decorative gradient */}
      <div className={cn("absolute -bottom-10 -right-10 w-24 h-24 blur-[40px] opacity-10 rounded-full", bg)} />
    </motion.div>
  );

  return (
    <div className="h-[calc(100vh-theme(spacing.20))] overflow-y-auto custom-scrollbar no-scrollbar bg-muted/[0.02]">
      <div className="p-8 max-w-[1600px] mx-auto space-y-10 pb-32">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-black tracking-tight text-foreground flex items-center gap-4">
              Commerce Engine
              <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-3 py-1">
                 <div className="size-1.5 rounded-full bg-primary animate-pulse" />
                 <span className="text-[9px] font-black uppercase tracking-widest text-primary">Operational</span>
              </div>
            </h1>
            <p className="text-muted-foreground text-sm font-medium opacity-60 max-w-2xl leading-relaxed">
              Managing global sales flows, inventory intelligence, and automated WhatsApp checkout logistics.
            </p>
          </div>
          <div className="flex items-center gap-3">
             <Button 
               onClick={() => router.push('/commerce/catalog')}
               className="rounded-2xl h-12 px-8 font-black shadow-lg shadow-primary/25 bg-primary text-primary-foreground text-[10px] uppercase tracking-[0.2em] gap-2 group"
             >
               <Plus className="size-4 group-hover:rotate-90 transition-transform duration-500" /> New Product
             </Button>
          </div>
        </div>

        {/* Intelligence Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard 
            label="Total Ecosystem Sales" 
            value={`₹${stats?.totalSales?.toLocaleString() || '0'}`} 
            icon={TrendingUp} 
            color="text-emerald-500" 
            bg="bg-emerald-500/5" 
          />
          <StatCard 
            label="Order Throughput" 
            value={stats?.orderCount || '0'} 
            icon={ShoppingCart} 
            color="text-blue-500" 
            bg="bg-blue-500/5" 
          />
          <StatCard 
            label="Active Catalogue" 
            value={stats?.activeProducts || '0'} 
            icon={Package} 
            color="text-purple-500" 
            bg="bg-purple-500/5" 
          />
          <StatCard 
            label="Customer Reach" 
            value="--" 
            icon={Users} 
            color="text-amber-500" 
            bg="bg-amber-500/5" 
          />
        </div>

        {/* Navigation Control Center */}
        <div className="space-y-6">
           <div className="flex items-center gap-3 px-1">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">Module Control Center</h3>
              <div className="h-[1px] flex-1 bg-border/40" />
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-6">
              {QUICK_LINKS.map((link, i) => (
                <motion.div
                  key={link.path}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  whileHover={{ y: -5 }}
                  onClick={() => router.push(link.path)}
                  className={cn(
                    "group cursor-pointer p-8 rounded-[40px] border-2 transition-all relative overflow-hidden bg-card shadow-premium-sm",
                    link.border,
                    "hover:shadow-premium hover:border-primary/30"
                  )}
                >
                   <div className="flex items-start justify-between mb-8 relative z-10">
                      <div className={cn("p-4 rounded-[24px] shadow-lg transition-transform group-hover:scale-110", link.bg, link.color)}>
                         <link.icon className="size-6" />
                      </div>
                      <div className="flex flex-col items-end">
                         <div className="bg-muted/10 px-3 py-1 rounded-xl text-[8px] font-black uppercase tracking-widest text-muted-foreground">
                            {link.stats}
                         </div>
                      </div>
                   </div>
                   
                   <div className="space-y-3 relative z-10 px-1">
                      <h4 className="text-xl font-black tracking-tight group-hover:text-primary transition-colors">{link.title}</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed font-medium opacity-80 line-clamp-2">
                        {link.description}
                      </p>
                   </div>

                   <div className="mt-8 flex items-center justify-between relative z-10 px-1">
                      <span className="text-[9px] font-black uppercase tracking-widest text-primary opacity-0 group-hover:opacity-100 transition-all translate-x-[-10px] group-hover:translate-x-0">
                         Access Module
                      </span>
                      <div className="size-10 rounded-full bg-muted/50 flex items-center justify-center transition-all group-hover:bg-primary group-hover:text-white">
                         <ChevronRight className="size-4" />
                      </div>
                   </div>

                   {/* Background Glow */}
                   <div className={cn("absolute -top-20 -right-20 w-48 h-48 blur-[80px] opacity-0 group-hover:opacity-20 transition-opacity rounded-full", link.bg)} />
                </motion.div>
              ))}
           </div>
        </div>

        {/* Global Strategy Section */}
        <Card className="border-none ring-1 ring-border/30 bg-card rounded-[48px] shadow-premium-lg overflow-hidden group/card">
          <CardHeader className="p-10 pb-0">
             <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-2xl font-black tracking-tight flex items-center gap-3">
                     Global Checkout Intelligence
                     <Sparkles className="size-6 text-amber-500 fill-amber-500/20" />
                  </CardTitle>
                  <CardDescription className="text-xs font-semibold opacity-50 uppercase tracking-widest leading-none">Automating the path to revenue.</CardDescription>
                </div>
                <div className="size-14 rounded-[24px] bg-primary/5 flex items-center justify-center text-primary group-hover/card:scale-110 transition-transform duration-500">
                   <Globe className="size-7" />
                </div>
             </div>
          </CardHeader>
          <CardContent className="p-10">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-6">
                   <div className="h-48 rounded-[36px] bg-gradient-to-br from-indigo-500/5 to-purple-500/5 border border-border/10 flex flex-col items-center justify-center gap-4 relative overflow-hidden group/box">
                      <Bot className="size-12 text-primary opacity-20" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-40">AI Brain Sync</p>
                      <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent opacity-0 group-hover/box:opacity-40 transition-opacity" />
                   </div>
                   <div className="space-y-2">
                      <h5 className="font-black text-sm uppercase tracking-wide">Automated Selling</h5>
                      <p className="text-xs text-muted-foreground font-medium leading-relaxed">Your AI agents handle discovery, sizing, and payment link generation directly in WhatsApp.</p>
                   </div>
                </div>
                <div className="space-y-6">
                   <div className="h-48 rounded-[36px] bg-gradient-to-br from-emerald-500/5 to-teal-500/5 border border-border/10 flex flex-col items-center justify-center gap-4 relative overflow-hidden group/box">
                      <CreditCard className="size-12 text-emerald-500 opacity-20" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-40">Seamless Payments</p>
                      <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent opacity-0 group-hover/box:opacity-40 transition-opacity" />
                   </div>
                   <div className="space-y-2">
                      <h5 className="font-black text-sm uppercase tracking-wide">Multi-Gateway Hub</h5>
                      <p className="text-xs text-muted-foreground font-medium leading-relaxed">Integrated with Razorpay, Stripe, and PayPal for global and local payment reach.</p>
                   </div>
                </div>
                <div className="space-y-6">
                   <div className="h-48 rounded-[36px] bg-gradient-to-br from-blue-500/5 to-cyan-500/5 border border-border/10 flex flex-col items-center justify-center gap-4 relative overflow-hidden group/box">
                      <Truck className="size-12 text-blue-500 opacity-20" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-40">Logistic Sync</p>
                      <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent opacity-0 group-hover/box:opacity-40 transition-opacity" />
                   </div>
                   <div className="space-y-2">
                      <h5 className="font-black text-sm uppercase tracking-wide">Real-time Fulfillment</h5>
                      <p className="text-xs text-muted-foreground font-medium leading-relaxed">Tracking updates and order confirmations sent automatically to your customers.</p>
                   </div>
                </div>
             </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
