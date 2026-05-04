"use client";

import { MessageSquare, Layout, Globe, Tag, ExternalLink, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CampaignTemplatePreviewProps {
  campaign: any;
}

export function CampaignTemplatePreview({ campaign }: CampaignTemplatePreviewProps) {
  const snapshot = campaign.templateSnapshot;

  if (!snapshot) {
    return (
      <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-border/50 rounded-3xl text-muted-foreground">
        <Layout className="h-8 w-8 mb-2 opacity-20" />
        <p className="text-sm font-bold opacity-50 uppercase tracking-widest">No Template Preview Available</p>
      </div>
    );
  }

  return (
    <div className="bg-background border border-border/50 rounded-[40px] overflow-hidden shadow-premium-sm">
      <div className="p-8 border-b border-border/50 bg-muted/30">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 flex items-center gap-2">
          <Layout className="h-4 w-4" />
          Template Snapshot
        </h3>
      </div>

      <div className="p-8 space-y-6">
        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Template Name</p>
            <p className="font-bold text-sm truncate">{snapshot.name}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Language</p>
            <div className="flex items-center gap-2">
                <Globe className="h-3 w-3 text-muted-foreground" />
                <p className="font-bold text-sm uppercase">{snapshot.language || 'English (en)'}</p>
            </div>
          </div>
        </div>

        {/* Categories/Tags */}
        <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/10 font-bold uppercase text-[9px]">
                {snapshot.category}
            </Badge>
            <Badge variant="outline" className="text-muted-foreground border-border/50 font-bold uppercase text-[9px]">
                {snapshot.headerType || 'Text Header'}
            </Badge>
        </div>

        {/* Message Bubble Preview */}
        <div className="relative mt-8 bg-[#E7FFDB] dark:bg-[#0B3D33] p-4 rounded-2xl rounded-tl-none border border-black/5 shadow-sm max-w-[90%] mx-auto md:mx-0">
          <div className="absolute top-0 -left-2 w-0 h-0 border-t-[12px] border-t-[#E7FFDB] dark:border-t-[#0B3D33] border-l-[12px] border-l-transparent" />
          
          <div className="space-y-4">
             {(snapshot?.bodyText || campaign.template?.body?.text || campaign.message) ? (
                <p className="text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap leading-relaxed">
                    {snapshot?.bodyText || campaign.template?.body?.text || campaign.message}
                </p>
             ) : (
                <p className="text-sm italic text-muted-foreground/60">
                    Content preview not available for this campaign configuration.
                </p>
             )}

             {/* Buttons Preview (Industry Standard) */}
             {(campaign.template?.buttons?.enabled && campaign.template?.buttons?.items?.length > 0) && (
                <div className="space-y-2 pt-2 border-t border-black/5">
                   {campaign.template.buttons.items.map((btn: any, idx: number) => (
                      <div key={idx} className="bg-white/50 dark:bg-white/5 py-2 px-4 rounded-xl text-center text-[11px] font-black text-primary border border-primary/10 flex items-center justify-center gap-2">
                         {btn.type === 'URL' && <ExternalLink className="h-3 w-3" />}
                         {btn.type === 'PHONE_NUMBER' && <Info className="h-3 w-3" />}
                         {btn.text}
                      </div>
                   ))}
                </div>
             )}
             <div className="flex justify-end mt-1">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                   {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
             </div>
          </div>
        </div>

        <div className="bg-muted/50 p-4 rounded-2xl border border-border/20">
           <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-2 flex items-center gap-2">
              <Tag className="h-3 w-3" /> 
              Variable Mapping
           </p>
           <div className="grid grid-cols-2 gap-2">
               {Object.entries(campaign.variableMapping || {}).map(([key, value]: [string, any]) => (
                 <div key={key} className="flex items-center gap-2 bg-background p-2 rounded-xl border border-border/50 truncate">
                    <span className="text-[10px] font-bold text-primary opacity-50">{key}:</span>
                    <span className="text-[10px] font-black truncate">{typeof value === 'string' ? value : JSON.stringify(value)}</span>
                 </div>
               ))}
               {(!campaign.variableMapping || Object.keys(campaign.variableMapping).length === 0) && (
                 <p className="text-[10px] font-medium text-muted-foreground/40 italic">No dynamic variables mapped.</p>
               )}
           </div>
        </div>
      </div>
    </div>
  );
}
