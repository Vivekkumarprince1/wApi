"use client";

import React from 'react';
import { 
  Clock, 
  Calendar as CalendarIcon, 
  Globe, 
  Zap,
  CheckCircle2,
  Info
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';

interface ScheduleStepProps {
  campaignData: any;
  setCampaignData: React.Dispatch<React.SetStateAction<any>>;
}

export default function ScheduleStep({ campaignData, setCampaignData }: ScheduleStepProps) {
  // Get today's date in YYYY-MM-DD for min date
  const today = new Date().toISOString().split('T')[0];
  const updateScheduleField = (field: 'scheduleDate' | 'scheduleTime', value: string) => {
    setCampaignData((prev: any) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="space-y-6">
        <Label className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Select Delivery Time</Label>
        
        <RadioGroup 
          value={campaignData.scheduleType} 
          onValueChange={(val) => setCampaignData((prev: any) => ({ ...prev, scheduleType: val }))}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          <div 
            className={`
              relative flex flex-col gap-4 p-6 rounded-3xl border-2 transition-all cursor-pointer group
              ${campaignData.scheduleType === 'now' 
                ? 'border-primary bg-primary/5 ring-1 ring-primary/20 shadow-premium-sm' 
                : 'border-border/50 hover:border-border'}
            `}
            onClick={() => setCampaignData((prev: any) => ({ ...prev, scheduleType: 'now' }))}
          >
            <div className="flex items-center justify-between">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <Zap className="h-6 w-6" />
              </div>
              <RadioGroupItem value="now" id="now" className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="now" className="text-base font-black cursor-pointer">Launch Immediately</Label>
              <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                Your messages will be queued and sent to your audience as soon as you hit launch.
              </p>
            </div>
            <div className="pt-2">
               <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 text-[10px] font-black uppercase tracking-widest">
                 <CheckCircle2 className="h-3 w-3" /> Recommended
               </span>
            </div>
          </div>

          <div 
            className={`
              relative flex flex-col gap-4 p-6 rounded-3xl border-2 transition-all cursor-pointer group
              ${campaignData.scheduleType === 'later' 
                ? 'border-primary bg-primary/5 ring-1 ring-primary/20 shadow-premium-sm' 
                : 'border-border/50 hover:border-border'}
            `}
            onClick={() => setCampaignData((prev: any) => ({ ...prev, scheduleType: 'later' }))}
          >
            <div className="flex items-center justify-between">
              <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground group-hover:scale-110 transition-transform">
                <Clock className="h-6 w-6" />
              </div>
              <RadioGroupItem value="later" id="later" className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="later" className="text-base font-black cursor-pointer">Schedule for Later</Label>
              <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                Pick a specific date and time in the future. Perfect for event specialized broadcasts.
              </p>
            </div>
          </div>
        </RadioGroup>
      </div>

      {campaignData.scheduleType === 'later' && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6 p-8 bg-muted/20 border border-border/50 rounded-3xl animate-in fade-in"
        >
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Send Date</Label>
            <div className="relative">
              <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                type="date" 
                min={today}
                value={campaignData.scheduleDate}
                onInput={(e) => updateScheduleField('scheduleDate', e.currentTarget.value)}
                onChange={(e) => updateScheduleField('scheduleDate', e.target.value)}
                className="pl-12 h-12 rounded-xl bg-background border-border/50 focus:ring-primary/20 font-bold"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Send Time</Label>
            <div className="relative">
              <Clock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                type="time" 
                value={campaignData.scheduleTime}
                onInput={(e) => updateScheduleField('scheduleTime', e.currentTarget.value)}
                onChange={(e) => updateScheduleField('scheduleTime', e.target.value)}
                className="pl-12 h-12 rounded-xl bg-background border-border/50 focus:ring-primary/20 font-bold"
              />
            </div>
          </div>
          <div className="md:col-span-2 flex items-center gap-3 px-4 py-3 bg-primary/5 rounded-2xl border border-primary/10 mt-2">
             <Globe className="h-4 w-4 text-primary" />
             <p className="text-[11px] font-bold text-foreground">
               Timezone: <span className="text-muted-foreground">Campaign will be sent according to your Workspace timezone (UTC+5:30).</span>
             </p>
          </div>
        </motion.div>
      )}

      <div className="p-4 bg-muted/30 rounded-2xl flex items-start gap-4 border border-border/50">
         <Info className="h-4 w-4 text-primary mt-0.5" />
         <div className="space-y-1">
            <p className="text-[11px] font-bold text-foreground uppercase tracking-tight">Queue Management</p>
            <p className="text-[10px] text-muted-foreground font-medium leading-normal">
              Large campaigns are processed in batches of 500 messages per minute to ensure optimal delivery rates and high message quality.
            </p>
         </div>
      </div>
    </div>
  );
}
