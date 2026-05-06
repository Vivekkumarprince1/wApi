"use client";

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
   Zap,
   Target,
   Banknote,
   ShieldCheck,
   TrendingUp,
   BrainCircuit,
   Layout,
   Smartphone
} from 'lucide-react';
import { DeviceSimulator } from './DeviceSimulator';
import { fetchTemplates, Template } from '@/lib/api/templates';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';

interface CampaignPreviewSidebarProps {
   campaignData: any;
}

export function CampaignPreviewSidebar({ campaignData }: CampaignPreviewSidebarProps) {
   const { data: templatesData } = useQuery({
      queryKey: ["templates", "APPROVED"],
      queryFn: () => fetchTemplates({ status: "APPROVED" }),
   });

   const templates: Template[] = templatesData?.data || [];
   const selectedTemplate = useMemo(
      () => templates.find((t) => (t._id === campaignData.templateId || t.id === campaignData.templateId)),
      [templates, campaignData.templateId]
   );

   const recipientCount = useMemo(() => {
      if (campaignData.audienceMode === 'specific') return campaignData.selectedContactIds.length;
      if (campaignData.audienceMode === 'csv') return campaignData.csvContacts.length;
      return 1250;
   }, [campaignData.audienceMode, campaignData.selectedContactIds, campaignData.csvContacts]);

   const estimatedCost = (recipientCount * 0.45).toFixed(2);

   return (
      <div className="animate-in fade-in slide-in-from-right-4 duration-500 h-full w-full flex flex-col overflow-hidden bg-gradient-to-b from-muted/30 via-muted/10 to-transparent">
         {/* Top: Live Monitor - Responsive height */}
         <div className="border-b border-border/50 pt-1 pb-2 px-2 relative  bg-gradient-to-b from-muted/40 to-transparent flex items-center justify-center">
            <div className="absolute top-1 right-1.5 flex items-center gap-0.5 bg-emerald-500/15 text-emerald-600 px-1.5 py-0.5 rounded-md border border-emerald-500/30 z-50 backdrop-blur-sm">
               <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
               <span className="text-[8px] font-bold uppercase tracking-wide">Live</span>
            </div>
            <DeviceSimulator 
               template={selectedTemplate} 
               variableMapping={campaignData.variableMapping}
               mediaUrl={campaignData.variableMapping?.mediaUrl}
            />
         </div>

         {/* Bottom: Analytics Hub - Responsive */}
         <div className="p-3 bg-gradient-to-b from-transparent to-muted/20 border-t border-border/50 space-y-3 overflow-y-auto shrink-0">
            {/* Main Stats Grid */}
            <div className="grid grid-cols-3 gap-1.5">
               <motion.div 
                  whileHover={{ y: -2 }}
                  className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 p-3 rounded-lg backdrop-blur-sm hover:shadow-lg hover:shadow-primary/10 transition-all duration-200 cursor-default"
               >
                  <div className="flex items-center gap-1 mb-1 text-primary">
                     <Target className="h-2.5 w-2.5" />
                     <span className="text-[8px] font-bold uppercase tracking-wider">Reach</span>
                  </div>
                  <p className="text-sm font-black tracking-tight">{recipientCount.toLocaleString()}</p>
                  <p className="text-[9px] text-muted-foreground font-medium mt-1">contacts</p>
               </motion.div>

               <motion.div 
                  whileHover={{ y: -2 }}
               className="bg-gradient-to-br from-amber-500/20 to-amber-500/5 border border-amber-500/30 p-3 rounded-lg backdrop-blur-sm hover:shadow-lg hover:shadow-amber-500/10 transition-all duration-200 cursor-default"
               >
                  <div className="flex items-center gap-1 mb-1 text-amber-600">
                     <Banknote className="h-2.5 w-2.5" />
                     <span className="text-[8px] font-bold uppercase tracking-wider">Budget</span>
                  </div>
                  <p className="text-sm font-black tracking-tight">₹{estimatedCost}</p>
                  <p className="text-[9px] text-muted-foreground font-medium mt-1">estimated</p>
               </motion.div>

               <motion.div 
                  whileHover={{ y: -2 }}
               className="bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/30 p-3 rounded-lg backdrop-blur-sm hover:shadow-lg hover:shadow-emerald-500/10 transition-all duration-200 cursor-default"
               >
                  <div className="flex items-center gap-1 mb-1 text-emerald-600">
                     <ShieldCheck className="h-2.5 w-2.5" />
                     <span className="text-[8px] font-bold uppercase tracking-wider">Health</span>
                  </div>
                  <p className="text-sm font-black tracking-tight text-emerald-600">98%</p>
                  <p className="text-[9px] text-muted-foreground font-medium mt-1">quality</p>
               </motion.div>
            </div>

            {/* Engagement Forecast */}
            <motion.div 
               whileHover={{ scale: 1.02 }}
               className="bg-gradient-to-r from-foreground via-foreground/95 to-foreground/90 text-background rounded-lg p-3 shadow-lg shadow-foreground/20 hover:shadow-xl hover:shadow-foreground/30 transition-all duration-200 overflow-hidden relative group"
            >
               <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
               <div className="relative z-10 flex items-start justify-between">
                  <div>
                     <p className="text-[9px] font-bold uppercase tracking-wider opacity-70 mb-1">Engagement</p>
                     <h4 className="text-sm font-black tracking-tight">High (8.4%)</h4>
                     <p className="text-[8px] opacity-60 mt-1">Based on template</p>
                  </div>
                  <TrendingUp className="h-4 w-4 text-primary shrink-0 group-hover:translate-y-0.5 transition-transform duration-300" />
               </div>
            </motion.div>

            {/* Campaign Health Bar */}
            <div className="bg-muted/20 border border-border/50 rounded-lg p-3 backdrop-blur-sm">
               <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Health</span>
                  <span className="text-[9px] font-bold text-emerald-600">Excellent</span>
               </div>
               <Progress value={98} className="h-1.5 bg-muted/60 rounded-full" />
            </div>
         </div>
      </div>
   );
}
