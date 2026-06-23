"use client";

import React, { useMemo } from 'react';
import { 
  Users, 
  MessageSquare, 
  Calendar, 
  TrendingUp,
  ShieldCheck,
  ArrowRight,
  Info
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ReviewStepProps {
  campaignData: any;
}

const SummaryCard = ({ icon: Icon, label, value, subValue, color = 'primary' }: any) => (
  <div className="bg-muted/10 border border-border/50 rounded-3xl p-6 flex flex-col gap-4 group hover:bg-muted/20 transition-all">
    <div className="flex items-center justify-between">
      <div className={`h-10 w-10 rounded-xl bg-${color}/10 flex items-center justify-center text-${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <Badge variant="outline" className="h-5 text-[9px] font-black uppercase tracking-tighter opacity-50">Verified</Badge>
    </div>
    <div className="space-y-1">
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-lg font-black text-foreground">{value}</p>
      {subValue && <p className="text-xs text-muted-foreground font-medium">{subValue}</p>}
    </div>
  </div>
);

export default function ReviewStep({ campaignData }: ReviewStepProps) {
  const campaignTypeLabel = campaignData.scheduleType === 'later'
    ? 'scheduled'
    : campaignData.type.replace('-', ' ');

  const audienceCount = useMemo(() => {
    // This is simplified for current context, in real app would match audience logic
    if (campaignData.audienceMode === 'specific') return campaignData.selectedContactIds.length;
    return 0; // fallback
  }, [campaignData]);



  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SummaryCard 
          icon={Users} 
          label="Audience" 
          value={`${audienceCount.toLocaleString()} Contacts`} 
          subValue={`Mode: ${campaignData.audienceMode.charAt(0).toUpperCase() + campaignData.audienceMode.slice(1)}`}
          color="blue"
        />
        <SummaryCard 
          icon={MessageSquare} 
          label="Message" 
          value="Approved Template" 
          subValue={campaignData.templateId ? "Template Selected" : "Missing Template"}
          color="emerald"
        />
        <SummaryCard 
          icon={Calendar} 
          label="Schedule" 
          value={campaignData.scheduleType === 'now' ? 'Immediate' : 'Scheduled'} 
          subValue={campaignData.scheduleType === 'later' ? `${campaignData.scheduleDate} at ${campaignData.scheduleTime}` : 'Launching on confirmation'}
          color="amber"
        />
      </div>

      <div className="bg-slate-900 rounded-3xl p-8 border border-white/5 space-y-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5">
           <ShieldCheck className="h-32 w-32 text-white" />
        </div>
        
        <div className="flex items-center gap-3">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-black uppercase tracking-widest text-white">Campaign Summary</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Campaign Name</p>
              <p className="text-sm font-bold text-slate-100">{campaignData.name}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Type</p>
              <p className="text-sm font-bold text-slate-100 capitalize">{campaignTypeLabel}</p>
            </div>
            {campaignData.description && (
              <div className="space-y-1">
                <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Notes</p>
                <p className="text-sm text-slate-300 italic line-clamp-2">{campaignData.description}</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Variable Mapping</p>
              <div className="space-y-2 pt-1">
                {Object.entries(campaignData.variableMapping).map(([v, f]: any) => (
                  <div key={v} className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded bg-white/10 text-primary-foreground/80 font-mono">{`{{${v}}}`}</span>
                    <ArrowRight className="h-3 w-3 text-white/20" />
                    <span className="font-bold text-slate-200">{f}</span>
                  </div>
                ))}
                {Object.keys(campaignData.variableMapping).length === 0 && (
                  <p className="text-xs text-white/20 font-bold italic">No variables to map</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 bg-muted/30 rounded-2xl flex items-start gap-4 border border-border/50">
         <Info className="h-4 w-4 text-primary mt-0.5" />
         <div className="space-y-1">
            <p className="text-[11px] font-bold text-foreground uppercase tracking-tight">Post-Launch Policy</p>
            <p className="text-[10px] text-muted-foreground font-medium leading-normal">
              Once a campaign is live, you can pause or stop it from the campaign history page. Sent messages cannot be unsent.
            </p>
         </div>
      </div>
    </div>
  );
}
