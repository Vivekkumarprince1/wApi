import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Users, Layers, Zap, CheckCircle2, Shield } from 'lucide-react';
import { StepProps } from './types';

export const StepQuotas: React.FC<StepProps> = ({ register }) => {
  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-2 gap-8">
        <div className="p-8 rounded-[32px] bg-muted/20 border border-border/50 space-y-4 hover:border-indigo-500/30 transition-colors">
          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Users className="h-4 w-4 text-indigo-600" /> Max Contact Capacity
          </Label>
          <Input type="number" {...register('limits.maxContacts')} className="h-14 rounded-2xl bg-background border-border/50 font-black text-2xl px-6" />
        </div>
        <div className="p-8 rounded-[32px] bg-muted/20 border border-border/50 space-y-4 hover:border-indigo-500/30 transition-colors">
          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Layers className="h-4 w-4 text-indigo-600" /> Monthly Message Volume
          </Label>
          <Input type="number" {...register('limits.maxMessagesPerMonth')} className="h-14 rounded-2xl bg-background border-border/50 font-black text-2xl px-6" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="p-6 rounded-3xl bg-muted/10 border border-border/40 space-y-3 hover:border-indigo-500/30 transition-colors">
          <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Zap className="h-3 w-3" /> Automations
          </Label>
          <Input type="number" {...register('limits.maxAutomations')} className="h-12 rounded-xl bg-background border-border/50 font-black text-xl px-4" />
        </div>
        <div className="p-6 rounded-3xl bg-muted/10 border border-border/40 space-y-3 hover:border-indigo-500/30 transition-colors">
          <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="h-3 w-3" /> Meta Templates
          </Label>
          <Input type="number" {...register('limits.maxTemplates')} className="h-12 rounded-xl bg-background border-border/50 font-black text-xl px-4" />
        </div>
        <div className="p-6 rounded-3xl bg-muted/10 border border-border/40 space-y-3 hover:border-indigo-500/30 transition-colors">
          <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Shield className="h-3 w-3" /> Bulk Campaigns
          </Label>
          <Input type="number" {...register('limits.maxCampaigns')} className="h-12 rounded-xl bg-background border-border/50 font-black text-xl px-4" />
        </div>
      </div>
    </div>
  );
};
