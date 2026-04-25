'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

/**
 * PageHeader - Standardized header for major feature pages
 * 
 * @param {LucideIcon} icon - Lucide icon component to display
 * @param {string} title - Main page title
 * @param {string} subtitle - Optional descriptive subtitle
 * @param {React.ReactNode} actions - Optional action buttons/elements (e.g. "Create Rule")
 * @param {React.ReactNode} extra - Optional secondary actions (e.g. "Refresh")
 * @param {string} className - Optional container className
 */
const PageHeader = ({ 
  icon: Icon, 
  title, 
  subtitle, 
  actions, 
  extra,
  className 
}) => {
  return (
    <div className={cn("mb-8 flex items-center justify-between flex-wrap gap-4 animate-fade-in-up", className)}>
      <div className="flex items-center gap-3">
        {Icon && <Icon className="h-7 w-7 text-primary" />}
        <div>
          <h1 className="text-3xl font-bold text-foreground">{title}</h1>
          {subtitle && <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>}
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        {extra}
        {actions}
      </div>
    </div>
  );
};

export default PageHeader;
