import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { DollarSign, Zap } from 'lucide-react';
import { StepProps } from './types';

export const StepEconomics: React.FC<StepProps> = ({ register, watch, setValue }) => {
  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-2 gap-8">
        <div className="p-8 rounded-[40px] bg-indigo-500/5 border border-indigo-500/20 space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-600">
              <DollarSign className="h-5 w-5" />
            </div>
            <p className="text-sm font-black uppercase tracking-widest">Monthly Billing</p>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Fee (INR)</Label>
            <div className="relative">
              <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-indigo-600">₹</span>
              <Input 
                type="number"
                className="h-16 rounded-2xl bg-background border-border/50 font-black text-2xl pl-12 pr-6"
                defaultValue={watch('monthlyBaseFeeCents') / 100}
                onChange={(e) => setValue('monthlyBaseFeeCents', Math.round(parseFloat(e.target.value) * 100))}
              />
            </div>
          </div>
        </div>

        <div className="p-8 rounded-[40px] bg-amber-500/5 border border-amber-500/20 space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-600">
              <Zap className="h-5 w-5" />
            </div>
            <p className="text-sm font-black uppercase tracking-widest">Yearly Billing</p>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Fee (INR)</Label>
            <div className="relative">
              <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-amber-600">₹</span>
              <Input 
                type="number"
                className="h-16 rounded-2xl bg-background border-border/50 font-black text-2xl pl-12 pr-6"
                defaultValue={(watch('yearlyBaseFeeCents') || 0) / 100}
                onChange={(e) => setValue('yearlyBaseFeeCents', Math.round(parseFloat(e.target.value) * 100))}
              />
            </div>
          </div>
          <p className="text-[10px] text-orange-600 font-bold uppercase tracking-widest pl-1 italic">
            Save ~{(1 - ((watch('yearlyBaseFeeCents') || 0) / (watch('monthlyBaseFeeCents') * 12 || 1))) * 100 | 0}% with yearly
          </p>
        </div>
      </div>

      <div className="p-8 rounded-[40px] bg-muted/20 border border-border/50 space-y-8">
        <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground border-b border-border/50 pb-4">Conversation Markups (%)</h4>
        <div className="grid grid-cols-4 gap-6">
          {(['marketing', 'utility', 'authentication', 'service'] as const).map((type) => (
            <div key={type} className="space-y-3">
              <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground capitalize">{type}</Label>
              <div className="relative">
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground/50 text-[10px]">%</span>
                <Input 
                  type="number" 
                  {...register(`conversationPricing.${type}MarkupPercent` as any)} 
                  className="h-12 rounded-xl bg-background border-border/50 font-black text-lg px-4 pr-8"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
