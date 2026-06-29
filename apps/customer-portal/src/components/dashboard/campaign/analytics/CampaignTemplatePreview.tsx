"use client";

import { Layout, Globe, Tag, ExternalLink, Phone, CornerDownLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CampaignTemplatePreviewProps {
  campaign: any;
}

export function CampaignTemplatePreview({ campaign }: CampaignTemplatePreviewProps) {
  const snapshot = campaign.templateSnapshot || campaign.template;
  const name = snapshot?.name || campaign.templateName || 'Broadcast Message';
  const language = snapshot?.language || campaign.languageCode || 'en';
  const category = snapshot?.category || campaign.template?.category || 'MARKETING';
  const components = Array.isArray(snapshot?.components)
    ? snapshot.components
    : Array.isArray(campaign.template?.components)
      ? campaign.template.components
      : [];
  const getComponent = (type: string) =>
    components.find((component: any) => String(component?.type || '').toUpperCase() === type);
  const bodyComponent = getComponent('BODY');
  const headerComponent = snapshot?.header || getComponent('HEADER');
  const buttonsComponent = getComponent('BUTTONS');
  const bodyText = snapshot?.bodyText || snapshot?.body?.text || bodyComponent?.text || campaign.message || '';
  const headerType = snapshot?.headerType || (headerComponent?.format ? `${headerComponent.format} Header` : 'Text Header');

  if (!bodyText && !snapshot) {
    return (
      <div className="flex flex-col items-center justify-center p-8 border border-dashed border-border/70 rounded-xl text-muted-foreground">
        <Layout className="h-8 w-8 mb-2 opacity-20" />
        <p className="text-sm font-bold opacity-50 uppercase tracking-widest">No Template Preview Available</p>
      </div>
    );
  }

  // Inject variable mapping values directly into body text for real preview
  const getInjectedBodyText = () => {
    let text = bodyText;
    const mapping = campaign.variableMapping || {};
    Object.entries(mapping).forEach(([key, val]) => {
      const placeholder = `{{${key}}}`;
      text = text.replaceAll(placeholder, String(val || placeholder));
    });
    return text;
  };

  // Helper to format text with dynamic bold and highlight pills
  const formatBodyText = (text: string) => {
    if (!text) return '';
    const parts = text.split(/(\{\{[^}]+\}\}|\*[^*]+\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('{{') && part.endsWith('}}')) {
        const varNum = part.slice(2, -2);
        const mappedVal = campaign.variableMapping?.[varNum];
        return (
          <span 
            key={index} 
            className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-extrabold border border-emerald-500/20 text-[10px] mx-0.5"
            title={`Variable {{${varNum}}}`}
          >
            {mappedVal || part}
          </span>
        );
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return <strong key={index} className="font-extrabold text-foreground">{part.slice(1, -1)}</strong>;
      }
      return part;
    });
  };

  // Extract buttons
  const buttonsList = snapshot?.buttons?.items || campaign.template?.buttons?.items || buttonsComponent?.buttons || [];

  return (
    <div className="bg-background border border-border/70 rounded-xl overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-border/50 bg-muted/30">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-2">
          <Layout className="h-4 w-4" />
          Template Snapshot
        </h3>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Template Name</p>
            <p className="font-bold text-sm truncate text-foreground">{name}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Language</p>
            <div className="flex items-center gap-2">
                <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="font-bold text-xs uppercase text-foreground">{language}</p>
            </div>
          </div>
        </div>

        {/* Categories/Tags */}
        <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/10 font-bold uppercase text-[9px]">
                {category}
            </Badge>
            <Badge variant="outline" className="text-muted-foreground border-border/50 font-bold uppercase text-[9px]">
                {headerType}
            </Badge>
        </div>

        {/* Message Bubble Preview */}
        <div className="relative mt-8 bg-[#efeae2] dark:bg-zinc-950 p-4 sm:p-6 rounded-xl border border-border/40 overflow-hidden">
          {/* WhatsApp wallpaper texture */}
          <div 
            className="absolute inset-0 opacity-[0.06] pointer-events-none bg-repeat bg-center" 
            style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")' }} 
          />

          <div className="relative z-10 bg-background dark:bg-zinc-900 rounded-lg rounded-tl-none shadow-md border border-border/10 p-3.5 max-w-[95%] mx-auto md:mx-0">
            {/* Bubble Tail */}
            <div className="absolute top-0 -left-1 w-2.5 h-2.5 bg-background dark:bg-zinc-900 border-l border-t border-border/10 -rotate-45" />
            
            <div className="space-y-2">
               {/* Body Text */}
               <div className="text-[12px] font-medium leading-relaxed text-foreground whitespace-pre-wrap">
                 {formatBodyText(getInjectedBodyText())}
               </div>

               {/* Time Stamp */}
               <div className="text-right text-[8px] text-muted-foreground font-semibold">
                 {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
               </div>
            </div>

            {/* Buttons Preview */}
            {buttonsList.length > 0 && (
               <div className="border-t border-border/10 mt-3 pt-1 divide-y divide-border/10">
                  {buttonsList.map((btn: any, idx: number) => (
                     <div 
                       key={idx} 
                       className="py-2 text-[10px] font-bold text-primary hover:bg-primary/5 cursor-pointer flex items-center justify-center gap-1.5 select-none transition-colors border-border/10"
                     >
                        {btn.type === 'URL' && <ExternalLink className="h-3 w-3 flex-shrink-0" />}
                        {btn.type === 'PHONE_NUMBER' && <Phone className="h-3 w-3 flex-shrink-0" />}
                        {btn.type === 'QUICK_REPLY' && <CornerDownLeft className="h-3 w-3 flex-shrink-0" />}
                        {btn.text}
                     </div>
                  ))}
               </div>
            )}
          </div>
        </div>

        <div className="bg-muted/50 p-4 rounded-xl border border-border/20">
           <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-2 flex items-center gap-2">
              <Tag className="h-3 w-3" /> 
              Variable Mapping
           </p>
           <div className="grid grid-cols-2 gap-2">
               {Object.entries(campaign.variableMapping || {}).map(([key, value]: [string, any]) => (
                 <div key={key} className="flex items-center gap-2 bg-background p-2 rounded-lg border border-border/50 truncate">
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
