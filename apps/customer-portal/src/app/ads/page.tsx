"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getAds } from '@/lib/api/ads';
import { Megaphone, Plus, Search, Target, Zap, BarChart3, ArrowRight, MousePointer2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

export default function AdsPage() {
  const router = useRouter();
  const { data: ads, isLoading } = useQuery({
    queryKey: ['ads'],
    queryFn: getAds
  });
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-[24px] bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-white shadow-lg shadow-pink-500/20">
                <Megaphone className="h-8 w-8" />
            </div>
            <div>
                <h1 className="text-4xl font-black tracking-tight text-foreground uppercase">WhatsApp Ads</h1>
                <p className="text-muted-foreground mt-1 font-medium font-mono text-xs uppercase tracking-widest">Click-to-WhatsApp Ads Management (CTWA)</p>
            </div>
        </div>
        <Button onClick={() => { router.push('/integrations'); }} className="rounded-full px-6 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 font-bold uppercase tracking-tighter h-12">
          <Plus className="mr-2 h-4 w-4" /> Launch Ad Campaign
        </Button>
      </div>

      {/* Ad Performance Concept */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border-none bg-card ring-1 ring-border/50 shadow-sm rounded-[48px] p-10 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:scale-110 transition-transform">
                <Target className="w-48 h-48" />
            </div>
            <div className="relative z-10 space-y-6">
                <Badge className="bg-emerald-500/20 text-emerald-600 border-none px-4 py-1 rounded-full font-black text-[10px] tracking-widest uppercase">Meta Integration Active</Badge>
                <div className="space-y-2 max-w-lg">
                    <h2 className="text-3xl font-black tracking-tight">Reach 2 Billion WhatsApp Users.</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        Drive traffic from Instagram and Facebook directly into your WhatsApp Inbox. Track conversions, ROI, and agent performance in real-time.
                    </p>
                </div>
                <div className="flex gap-4">
                    <div className="bg-muted/50 p-6 rounded-[32px] flex-1 border border-border/50">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Avg. CPC</p>
                        <p className="text-2xl font-black">$0.00</p>
                    </div>
                    <div className="bg-muted/50 p-6 rounded-[32px] flex-1 border border-border/50">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Total Leads</p>
                        <p className="text-2xl font-black">0</p>
                    </div>
                </div>
            </div>
        </Card>

        <div className="flex flex-col gap-6">
            <Card className="border-none bg-gradient-to-br from-indigo-600 to-indigo-800 text-white rounded-[40px] p-8 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
                    <Zap className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-lg font-black leading-tight">Sync Meta Pixel with WhatsApp Flows</h3>
                <p className="text-xs text-indigo-100/70 font-medium">Automatically retarget users who abandoned their WhatsApp forms.</p>
                <Button variant="ghost" onClick={() => { router.push('/integrations'); }} className="w-full bg-white/10 text-white hover:bg-white/20 rounded-2xl font-bold text-xs uppercase tracking-widest">Connect Pixel</Button>
            </Card>

            <Card className="border-none bg-card ring-1 ring-border/50 rounded-[40px] p-8 flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                    <MousePointer2 className="h-6 w-6" />
                </div>
                <div>
                   <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Active Campaigns</p>
                   <p className="text-xl font-black">{ads?.length || 0}</p>
                </div>
            </Card>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-4 bg-muted/30 p-2 rounded-2xl border border-border/50">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search ad sets and campaigns..." 
            className="pl-10 bg-transparent border-none focus-visible:ring-0 font-bold"
          />
        </div>
        <Button variant="ghost" size="sm" onClick={() => { router.push('/analytics/advanced'); }} className="rounded-xl">
          <BarChart3 className="mr-2 h-4 w-4" /> Analytics Console
        </Button>
      </div>

      {/* Empty State */}
      <div className="bg-card border border-border/50 rounded-[48px] p-16 flex flex-col items-center text-center space-y-4 shadow-sm">
        {isLoading ? (
          <div className="flex flex-col items-center gap-4 py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-sm font-bold text-muted-foreground">Syncing with Meta...</p>
          </div>
        ) : ads?.length === 0 ? (
          <>
            <div className="w-24 h-24 rounded-[36px] bg-pink-500/10 flex items-center justify-center text-pink-600 mb-2">
              <Megaphone className="h-12 w-12" />
            </div>
            <h3 className="text-2xl font-black text-foreground">No Ad Campaigns Found</h3>
            <p className="text-muted-foreground max-w-sm mx-auto font-medium">
                You haven't linked your Facebook Ad Account yet. Connect to start driving high-intent traffic to WhatsApp.
            </p>
            <Button variant="outline" onClick={() => { router.push('/integrations'); }} className="rounded-full px-8 mt-4 border-pink-500/20 hover:bg-pink-500/5 text-pink-600 font-black uppercase tracking-widest text-xs h-12 group">
              Connect Ad Account <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </>
        ) : (
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
             {ads?.map((ad: any) => (
               <Card key={ad._id} className="p-6 rounded-3xl text-left border-border/40">
                  <div className="flex items-center justify-between mb-4">
                     <h4 className="font-black text-sm uppercase tracking-tight">{ad.name}</h4>
                     <Badge variant="outline">{ad.status}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                     <div className="text-[10px] font-bold text-muted-foreground uppercase">Clicks: {ad.clicks || 0}</div>
                     <div className="text-[10px] font-bold text-muted-foreground uppercase">Spend: ${ad.spend || 0}</div>
                  </div>
               </Card>
             ))}
          </div>
        )}
      </div>
    </div>
  );
}
