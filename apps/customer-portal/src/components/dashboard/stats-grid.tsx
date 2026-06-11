"use client";

import React from 'react';
import { Users, Send, CheckCircle, Eye, TrendingUp, TrendingDown, LucideIcon, Lock, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useFeatureGate } from '@/store/auth-store';
import { motion } from 'framer-motion';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeType?: 'up' | 'down';
  icon: LucideIcon;
  color: string;
  subtitle?: string;
  isLocked?: boolean;
}

const StatCard = ({ title, value, change, changeType, icon: Icon, color, subtitle, isLocked }: StatCardProps) => {
  const router = useRouter();
  return (
  <div className={`group relative bg-card rounded-2xl p-5 border border-border/50 hover:shadow-premium transition-all duration-300 hover:-translate-y-0.5 overflow-hidden ${isLocked ? 'cursor-not-allowed' : ''}`}>
    <div className={`absolute top-0 right-0 w-28 h-28 bg-gradient-to-br ${color} opacity-[0.07] rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500`} />
    
    <div className={`relative z-10 transition-all duration-500 ${isLocked ? 'blur-[6px] grayscale opacity-40 select-none' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300`}>
          <Icon className="text-white h-5 w-5" />
        </div>
        {change !== undefined && (
          <div className={`flex items-center gap-1 text-sm font-semibold ${changeType === 'up' ? 'text-emerald-500' : 'text-destructive'}`}>
            {changeType === 'up' ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            <span>{change}%</span>
          </div>
        )}
      </div>
      <h3 className="text-sm font-medium text-muted-foreground mb-1">{title}</h3>
      <p className="text-2xl font-bold text-foreground">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
    </div>

    {/* Locked Overlay */}
    {isLocked && (
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 p-4 bg-background/20 backdrop-blur-[1px] animate-in fade-in duration-500">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shadow-sm border border-primary/20">
          <Lock className="h-5 w-5" />
        </div>
        <div className="text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">Premium Metric</p>
            <button onClick={() => { router.push('/billing'); }} className="text-[9px] font-bold bg-primary text-white px-3 py-1 rounded-full shadow-lg shadow-primary/20 hover:scale-105 transition-transform flex items-center gap-1 mx-auto">
                <Sparkles className="h-2 w-2" /> Upgrade
            </button>
        </div>
      </div>
    )}
  </div>
  );
};

interface StatsGridProps {
  stats: {
    totalContacts: number;
    messagesSent: number;
    deliveryRate: number;
    openRate: number;
  };
}

const StatsGrid = ({ stats }: StatsGridProps) => {
  const contactsGate = useFeatureGate('stats-total-contacts');
  const messagesGate = useFeatureGate('stats-messages-sent');
  const deliveryGate = useFeatureGate('stats-delivery-rate');
  const openRateGate = useFeatureGate('stats-open-rate');

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-8 -mt-6 relative z-10">
      <StatCard 
        title="Total Contacts" 
        value={stats.totalContacts} 
        change={12} 
        changeType="up" 
        icon={Users} 
        color="from-blue-500 to-blue-600" 
        subtitle="Growing steadily" 
        isLocked={!contactsGate.gate.allowed}
      />
      <StatCard 
        title="Messages Sent" 
        value={stats.messagesSent} 
        change={8} 
        changeType="up" 
        icon={Send} 
        color="from-emerald-500 to-emerald-600" 
        subtitle="This month" 
        isLocked={!messagesGate.gate.allowed}
      />
      <StatCard 
        title="Delivery Rate" 
        value={`${stats.deliveryRate}%`} 
        change={2} 
        changeType="up" 
        icon={CheckCircle} 
        color="from-violet-500 to-violet-600" 
        subtitle="Industry avg: 89%" 
        isLocked={!deliveryGate.gate.allowed}
      />
      <StatCard 
        title="Open Rate" 
        value={`${stats.openRate}%`} 
        change={5} 
        changeType="up" 
        icon={Eye} 
        color="from-amber-500 to-amber-600" 
        subtitle="Above average!" 
        isLocked={!openRateGate.gate.allowed}
      />
    </div>
  );
};

export default StatsGrid;
