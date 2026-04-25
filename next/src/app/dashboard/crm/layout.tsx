"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  BarChart3, 
  LayoutGrid, 
  CheckSquare, 
  TrendingUp,
  Target,
  ListTodo,
  FileBarChart
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function CRMLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const tabs = [
    {
      title: 'Pipeline',
      href: '/dashboard/crm/pipeline',
      icon: Target,
      active: pathname === '/dashboard/crm/pipeline'
    },
    {
      title: 'Tasks',
      href: '/dashboard/crm/tasks',
      icon: ListTodo,
      active: pathname === '/dashboard/crm/tasks'
    },
    {
      title: 'Reports',
      href: '/dashboard/crm/reports',
      icon: FileBarChart,
      active: pathname === '/dashboard/crm/reports'
    }
  ];

  return (
    <div className="flex flex-col gap-6 h-full font-sans">
      {/* Secondary Navigation Tags/Tabs */}
      <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-2xl w-fit self-center md:self-start border border-border/50 backdrop-blur-sm">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl transition-all duration-300 text-xs font-black uppercase tracking-widest leading-none",
              tab.active
                ? "bg-background text-primary shadow-premium-sm ring-1 ring-border/50"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <tab.icon className={cn("size-3.5", tab.active ? "text-primary" : "text-muted-foreground")} />
            {tab.title}
          </Link>
        ))}
      </div>

      {/* Page Content */}
      <div className="flex-1 min-h-0 animate-in fade-in slide-in-from-bottom-2 duration-700">
        {children}
      </div>
    </div>
  );
}
