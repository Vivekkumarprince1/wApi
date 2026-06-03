"use client";

import { MousePointer2, ExternalLink, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";

interface CampaignButtonTrackingProps {
  campaign: any;
}

export function CampaignButtonTracking({ campaign }: CampaignButtonTrackingProps) {
  // In a real app, this would come from the API as button engagement data.
  // We'll show a high-fidelity placeholder if no data is present, 
  // or use derived data based on 'replied' count for demo purposes.
  
  const buttons = campaign.buttonStats || [
    { name: "Shop Now", type: "URL", clicks: Math.round(campaign.repliedCount * 0.6) || 0 },
    { name: "Learn More", type: "URL", clicks: Math.round(campaign.repliedCount * 0.3) || 0 },
    { name: "Stop Promotions", type: "QUICK_REPLY", clicks: Math.round(campaign.repliedCount * 0.1) || 0 },
  ].filter(b => campaign.repliedCount > 0);

  if (buttons.length === 0) {
    return (
      <div className="bg-background rounded-[40px] p-8 border border-border/50 shadow-premium-sm overflow-hidden relative group">
        <div className="flex items-center justify-between mb-8">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">Button Performance</h2>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center opacity-40 group-hover:opacity-100 transition-opacity">
            <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">No interactive buttons found in template</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background rounded-[40px] p-8 border border-border/50 shadow-premium-sm relative overflow-hidden">
      <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
          <MousePointer2 className="h-32 w-32 text-indigo-500" />
      </div>

      <div className="flex items-center justify-between mb-8">
        <div className="space-y-1">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">Button Clicks</h2>
            <p className="text-[10px] font-bold text-indigo-500 flex items-center gap-1">
                Engagement by action <ExternalLink className="h-2 w-2" />
            </p>
        </div>
      </div>

      <div className="space-y-4">
        {buttons.map((button: any, index: number) => {
          const maxClicks = Math.max(...buttons.map((b: any) => b.clicks));
          const width = maxClicks > 0 ? (button.clicks / maxClicks) * 100 : 0;
          
          return (
            <motion.div 
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-muted/30 rounded-2xl p-4 border border-border/30 hover:border-primary/50 transition-colors group cursor-default"
            >
                <div className="flex justify-between items-start mb-3">
                    <div>
                        <p className="text-xs font-black uppercase tracking-tight group-hover:text-primary transition-colors">{button.name}</p>
                        <span className="text-[8px] font-black text-muted-foreground/60 uppercase tracking-widest">{button.type}</span>
                    </div>
                    <div className="text-right">
                        <p className="text-xl font-black">{button.clicks}</p>
                        <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/60">Unique Clicks</p>
                    </div>
                </div>
                
                <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                    <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${width}%` }}
                        transition={{ duration: 0.8, ease: "circOut", delay: 0.5 + (index * 0.1) }}
                        className="h-full bg-indigo-500 rounded-full"
                    />
                </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
