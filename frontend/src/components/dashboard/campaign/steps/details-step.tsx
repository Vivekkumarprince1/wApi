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
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Basic Info Section */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-sm font-semibold text-foreground flex items-center gap-2">
            <span className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">1</span>
            Campaign Name
          </Label>
          <Input
            id="name"
            placeholder="e.g., Summer Sale 2024"
            value={campaignData.name}
            onChange={(e) => setCampaignData({ ...campaignData, name: e.target.value })}
            className="h-11 rounded-lg bg-muted/40 border border-border/60 focus:border-primary/50 focus:bg-background focus:ring-2 focus:ring-primary/20 text-base font-medium transition-all duration-200"
          />
          <p className="text-xs text-muted-foreground font-medium px-1">For internal tracking only – won't be seen by customers</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description" className="text-sm font-semibold text-foreground flex items-center gap-2">
            <span className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">2</span>
            Description
          </Label>
          <Textarea
            id="description"
            placeholder="What is this campaign about? (Optional)"
            value={campaignData.description}
            onChange={(e) => setCampaignData({ ...campaignData, description: e.target.value })}
            className="min-h-[100px] rounded-lg bg-muted/40 border border-border/60 focus:border-primary/50 focus:bg-background focus:ring-2 focus:ring-primary/20 text-base font-medium resize-none transition-all duration-200"
          />
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      {/* Type Selection */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
          <span className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">3</span>
          Campaign Type
        </Label>
        <RadioGroup 
          value={campaignData.type} 
          onValueChange={(val) => setCampaignData({ ...campaignData, type: val })}
          className="grid grid-cols-2 gap-3"
        >
          <div 
            className={`
              relative flex items-start gap-3 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer group
              ${campaignData.type === 'one-time' 
                ? 'border-primary bg-gradient-to-br from-primary/10 to-primary/5 ring-1 ring-primary/20 shadow-lg shadow-primary/10' 
                : 'border-border/50 hover:border-border/80 bg-muted/20 hover:bg-muted/40'}
            `}
            onClick={() => setCampaignData({ ...campaignData, type: 'one-time' })}
          >
            <RadioGroupItem value="one-time" id="one-time" className="mt-0.5 h-5 w-5" />
            <div className="space-y-1 flex-1 min-w-0">
              <Label htmlFor="one-time" className="text-sm font-bold cursor-pointer flex items-center gap-2">
                <Send className={`h-4 w-4 transition-all duration-200 ${campaignData.type === 'one-time' ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
                <span>One-time</span>
              </Label>
              <p className="text-xs text-muted-foreground font-medium line-clamp-2">Send now or at scheduled time</p>
            </div>
          </div>

          <div 
            className={`
              relative flex items-start gap-3 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer group
              ${campaignData.type === 'scheduled' 
                ? 'border-primary bg-gradient-to-br from-primary/10 to-primary/5 ring-1 ring-primary/20 shadow-lg shadow-primary/10' 
                : 'border-border/50 hover:border-border/80 bg-muted/20 hover:bg-muted/40'}
            `}
            onClick={() => setCampaignData({ ...campaignData, type: 'scheduled' })}
          >
            <RadioGroupItem value="scheduled" id="scheduled" className="mt-0.5 h-5 w-5" />
            <div className="space-y-1 flex-1 min-w-0">
              <Label htmlFor="scheduled" className="text-sm font-bold cursor-pointer flex items-center gap-2">
                <History className={`h-4 w-4 transition-all duration-200 ${campaignData.type === 'scheduled' ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
                <span>Recurring</span>
              </Label>
              <p className="text-xs text-muted-foreground font-medium line-clamp-2">Auto-trigger based on behavior</p>
            </div>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
}
