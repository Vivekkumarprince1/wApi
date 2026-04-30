import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { StepProps } from './types';

export const StepIdentity: React.FC<StepProps> = ({ register, watch, setValue }) => {
  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-2 gap-8">
        <div className="space-y-3">
          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Marketplace Name</Label>
          <Input {...register('name', { required: true })} placeholder="e.g. Enterprise Growth" className="h-14 rounded-2xl bg-muted/20 border-border/50 font-bold text-lg px-6" />
        </div>
        <div className="space-y-3">
          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">System Slug (Unique)</Label>
          <Input {...register('slug', { required: true })} placeholder="e.g. growth-v2" className="h-14 rounded-2xl bg-muted/20 border-border/50 font-bold text-lg px-6" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8">
        <div className="p-8 rounded-[32px] bg-muted/20 border border-border/50 space-y-4 hover:border-indigo-500/30 transition-colors">
          <div className="flex justify-between items-center">
            <div className="space-y-0.5">
              <p className="text-xs font-black uppercase tracking-widest">Visibility</p>
              <p className="text-[10px] text-muted-foreground">Is this plan visible to users?</p>
            </div>
            <Switch 
              checked={watch('isActive')} 
              onCheckedChange={(v) => setValue('isActive', v)}
              className="scale-110"
            />
          </div>
        </div>

        <div className="p-8 rounded-[32px] bg-muted/20 border border-border/50 space-y-4 hover:border-indigo-500/30 transition-colors">
          <div className="flex justify-between items-center">
            <div className="space-y-0.5">
              <p className="text-xs font-black uppercase tracking-widest">Default Assignment</p>
              <p className="text-[10px] text-muted-foreground">Assign this to all new signups?</p>
            </div>
            <Switch 
              checked={watch('isDefault')} 
              onCheckedChange={(v) => setValue('isDefault', v)}
              className="scale-110"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
