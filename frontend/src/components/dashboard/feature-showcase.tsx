"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { Flame, Send, Bell, Globe, TrendingUp, LucideIcon } from 'lucide-react';

interface Feature {
  title: string;
  desc: string;
  icon: LucideIcon;
  color: string;
  href: string;
}

const FeatureShowcase = () => {
  const router = useRouter();

  const features: Feature[] = [
    { title: 'Bulk Campaigns', desc: 'Send to thousands instantly', icon: Send, color: 'from-emerald-500 to-emerald-600', href: '/campaign' },
    { title: 'Automation', desc: 'Auto-reply & workflows', icon: Bell, color: 'from-blue-500 to-blue-600', href: '/automation' },
    { title: 'Commerce', desc: 'Catalog & checkout', icon: Globe, color: 'from-violet-500 to-violet-600', href: '/commerce' },
    { title: 'Integrations', desc: 'Connect your tools', icon: TrendingUp, color: 'from-amber-500 to-amber-600', href: '/integrations' },
  ];

  return (
    <div className="bg-gradient-to-br from-primary/5 via-transparent to-violet-500/5 rounded-2xl p-5 border border-border/50">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-pink-500 rounded-xl flex items-center justify-center shadow-md">
          <Flame className="text-white h-4 w-4" />
        </div>
        <div>
          <h2 className="text-base font-bold text-foreground">Popular Features</h2>
          <p className="text-xs text-muted-foreground">Boost your WhatsApp marketing</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {features.map(f => (
          <div key={f.title} onClick={() => router.push(f.href)}
            className="group cursor-pointer bg-card rounded-xl p-4 border border-border/50 hover:shadow-premium hover:border-primary/20 transition-all duration-300">
            <div className="flex items-center gap-3 mb-1.5">
              <div className={`w-8 h-8 bg-gradient-to-br ${f.color} rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform`}>
                <f.icon className="text-white h-3.5 w-3.5" />
              </div>
              <h3 className="font-bold text-foreground text-sm">{f.title}</h3>
            </div>
            <p className="text-xs text-muted-foreground ml-11">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FeatureShowcase;
