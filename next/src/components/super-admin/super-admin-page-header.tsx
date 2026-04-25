"use client";

import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type SuperAdminPageHeaderProps = {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  status?: React.ReactNode;
  className?: string;
};

export default function SuperAdminPageHeader({
  icon: Icon,
  eyebrow,
  title,
  subtitle,
  actions,
  status,
  className,
}: SuperAdminPageHeaderProps) {
  return (
    <div className={cn('flex flex-col lg:flex-row lg:items-center justify-between gap-6', className)}>
      <div className="flex items-center gap-5 lg:gap-6 min-w-0">
        <div className="w-16 h-16 md:w-20 md:h-20 rounded-[28px] bg-gradient-to-br from-emerald-500 to-emerald-800 flex items-center justify-center text-white shadow-2xl shadow-emerald-500/30 shrink-0">
          <Icon className="h-8 w-8 md:h-10 md:w-10" />
        </div>
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-none font-black text-[10px] tracking-[0.2em] uppercase py-0.5">
              {eyebrow}
            </Badge>
            {status}
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-foreground uppercase leading-none font-manrope">
            {title}
          </h1>
          <p className="text-muted-foreground font-medium text-sm md:text-[15px] leading-relaxed max-w-2xl font-inter">
            {subtitle}
          </p>
        </div>
      </div>

      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}
