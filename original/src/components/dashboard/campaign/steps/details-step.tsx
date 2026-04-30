"use client";

import React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar, Send, History } from 'lucide-react';

interface DetailsStepProps {
  campaignData: any;
  setCampaignData: (data: any) => void;
}

export default function DetailsStep({ campaignData, setCampaignData }: DetailsStepProps) {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Campaign Name</Label>
          <Input
            id="name"
            placeholder="e.g. Summer Sale 2024"
            value={campaignData.name}
            onChange={(e) => setCampaignData({ ...campaignData, name: e.target.value })}
            className="h-12 rounded-xl bg-muted/20 border-border/50 focus:ring-primary/20"
          />
          <p className="text-[10px] text-muted-foreground font-medium italic px-1">This name is for internal tracking and won&apos;t be seen by customers.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description" className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Description (Optional)</Label>
          <Textarea
            id="description"
            placeholder="What is this campaign about?"
            value={campaignData.description}
            onChange={(e) => setCampaignData({ ...campaignData, description: e.target.value })}
            className="min-h-[100px] rounded-xl bg-muted/20 border-border/50 focus:ring-primary/20"
          />
        </div>
      </div>

      <div className="space-y-4">
        <Label className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Campaign Type</Label>
        <RadioGroup 
          value={campaignData.type} 
          onValueChange={(val) => setCampaignData({ ...campaignData, type: val })}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <div 
            className={`
              relative flex items-start gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer
              ${campaignData.type === 'one-time' ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border/50 hover:border-border'}
            `}
            onClick={() => setCampaignData({ ...campaignData, type: 'one-time' })}
          >
            <RadioGroupItem value="one-time" id="one-time" className="mt-1" />
            <div className="space-y-1">
              <Label htmlFor="one-time" className="font-bold cursor-pointer flex items-center gap-2">
                <Send className="h-4 w-4 text-primary" />
                One-time Broadcast
              </Label>
              <p className="text-xs text-muted-foreground font-medium">Send a single blast to your selected list immediately or at a specific time.</p>
            </div>
          </div>

          <div 
            className={`
              relative flex items-start gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer
              ${campaignData.type === 'scheduled' ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border/50 hover:border-border'}
            `}
            onClick={() => setCampaignData({ ...campaignData, type: 'scheduled' })}
          >
            <RadioGroupItem value="scheduled" id="scheduled" className="mt-1" />
            <div className="space-y-1">
              <Label htmlFor="scheduled" className="font-bold cursor-pointer flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                Ongoing Campaign
              </Label>
              <p className="text-xs text-muted-foreground font-medium">Auto-trigger messages based on customer behavior or recurring schedules.</p>
            </div>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
}
