"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Check, 
  CheckCheck, 
  FileText, 
  Image as ImageIcon, 
  Video, 
  Mic, 
  StickyNote,
  User,
  AlertCircle,
  Download,
  Clock,
  ExternalLink,
  Phone,
  Zap,
  MapPin,
  RotateCcw,
  Smile,
  DollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Message } from '@/lib/api/inbox';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

const ReactionsOverlay = React.memo(({ reactions, align = 'right' }: { reactions: any; align?: 'left' | 'right' }) => {
  if (!reactions || Object.keys(reactions).length === 0) return null;

  const reactionItems = React.useMemo(() => {
    const expandedItems = Object.entries(reactions)
      .filter(([, reaction]) => Boolean(reaction))
      .flatMap(([reactionKey, reaction]: [string, any]) => {
        const repeatCount = Math.max(1, Number(reaction?.count) || 1);
        return Array.from({ length: repeatCount }, (_, repeatIndex) => ({
          key: `${reactionKey}-${repeatIndex}`,
          emoji: reaction?.emoji || '👍',
          timestamp: reaction?.timestamp || null,
          reactionMessageId: reaction?.reactionMessageId || reaction?.messageId || reactionKey,
        }));
      })
      .sort((left: any, right: any) => {
        const leftTime = new Date(left.timestamp || 0).getTime();
        const rightTime = new Date(right.timestamp || 0).getTime();
        return leftTime - rightTime;
      });

    return expandedItems;
  }, [reactions]);

  const visibleItems = reactionItems.slice(0, 6);
  const overflowCount = reactionItems.length - visibleItems.length;

  return (
    <div className={`absolute -bottom-4 z-20 flex w-fit max-w-[min(22rem,calc(100vw-2rem))] flex-wrap items-center gap-1.5 rounded-full border border-border/40 bg-background/95 px-2.5 py-1.5 shadow-lg backdrop-blur-md ${align === 'right' ? 'right-2' : 'left-2'}`}>
      {visibleItems.map((reaction: any, index: number) => (
        <div
          key={reaction.key || `${reaction.reactionMessageId || 'reaction'}-${reaction.timestamp || 'ts'}-${reaction.emoji || 'emoji'}-${index}`}
          className="flex h-7 min-w-7 items-center justify-center rounded-full bg-muted/40 px-2 text-[15px] leading-none animate-in zoom-in-75 duration-300 ring-1 ring-border/20"
        >
           <span className="translate-y-[0.5px]">{reaction.emoji || '👍'}</span>
        </div>
      ))}
      {overflowCount > 0 && (
        <div className="flex h-7 min-w-7 items-center justify-center rounded-full bg-background px-2 text-[10px] font-black leading-none ring-1 ring-border/20">
          +{overflowCount}
        </div>
      )}
    </div>
  );
});

const StatusIcon = React.memo(({ status, direction }: { status: string, direction: string }) => {
  if (direction === 'inbound') return null;
  switch (status) {
    case 'queued': return <Clock className="h-3 w-3 opacity-40" />;
    case 'sending': return <Clock className="h-3 w-3 opacity-40 animate-pulse" />;
    case 'sent': return <Check className="h-3 w-3 opacity-60" />;
    case 'delivered': return <CheckCheck className="h-3 w-3 opacity-60" />;
    case 'read': return <CheckCheck className="h-3 w-3 text-sky-500" />;
    case 'failed': return <AlertCircle className="h-3 w-3 text-destructive" />;
    default: return null;
  }
});

const getMessageBody = (message: Message) => {
  const body = typeof message.body === 'string' ? message.body : '';
  const text = typeof (message as any).text === 'string' ? (message as any).text : '';
  const template = (message as any).template;
  const templateBody =
    typeof template?.bodyText === 'string'
      ? template.bodyText
      : typeof template?.body?.text === 'string'
        ? template.body.text
        : Array.isArray(template?.components)
          ? template.components.find((component: any) => String(component?.type || '').toUpperCase() === 'BODY')?.text || ''
          : '';
  const caption = typeof message.media?.caption === 'string' ? message.media.caption : '';
  return body || text || templateBody || caption;
};

const TemplateRenderer = React.memo(({ message }: { message: Message }) => {
  const template = (message as any).template;
  const fallbackBody = getMessageBody(message) || `[Template: ${(template?.name || template?.metaTemplateName || 'message')}]`;
  if (!template) return <p className="text-[14.5px] leading-[1.45] break-words">{fallbackBody}</p>;
  
  const components = Array.isArray(template.components) ? template.components : [];
  const header = template.header || components.find((component: any) => String(component?.type || '').toUpperCase() === 'HEADER');
  const footerComponent = components.find((component: any) => String(component?.type || '').toUpperCase() === 'FOOTER');
  const buttonsComponent = components.find((component: any) => String(component?.type || '').toUpperCase() === 'BUTTONS');
  const buttons = Array.isArray(template.buttons)
    ? template.buttons
    : Array.isArray(template.buttons?.items)
      ? template.buttons.items
      : Array.isArray(buttonsComponent?.buttons)
        ? buttonsComponent.buttons
        : [];
  const hasRealUrl = !!(header?.mediaUrl && header.mediaUrl.startsWith('http'));
  const hasHandle = !!(header?.mediaHandle && !hasRealUrl);
  const isMediaFormat = ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(header?.format);
  const inferredFormat = header?.format && header.format !== 'NONE'
    ? header.format
    : (hasRealUrl || hasHandle ? 'IMAGE' : 'NONE');

  return (
    <div className="space-y-0 -mx-3 -mb-3">
      <div className="px-3 pb-3">
        {header && (inferredFormat !== 'NONE' || header.text) && (
          <div className="mb-2 rounded-lg overflow-hidden border border-black/5 bg-black/5 dark:bg-white/5">
            {inferredFormat === 'TEXT' && header.text && (
              <p className="font-bold text-sm p-3 break-words">{header.text}</p>
            )}
            {inferredFormat === 'IMAGE' && hasRealUrl && (
              <img src={header.mediaUrl} alt="Template header" className="w-full h-auto max-h-[200px] object-cover" onError={(e) => { (e.target as any).style.display = 'none'; }} />
            )}
            {inferredFormat === 'VIDEO' && hasRealUrl && (
              <video src={header.mediaUrl} controls className="w-full h-auto max-h-[200px] object-cover" />
            )}
            {isMediaFormat && !hasRealUrl && (hasHandle || inferredFormat !== 'NONE') && (
              <div className="h-[100px] flex flex-col items-center justify-center gap-2 opacity-40">
                {inferredFormat === 'VIDEO' ? <Video className="h-8 w-8" /> : inferredFormat === 'DOCUMENT' ? <FileText className="h-8 w-8" /> : <ImageIcon className="h-8 w-8" />}
                <span className="text-[9px] font-black uppercase tracking-widest">Media not publicly accessible</span>
              </div>
            )}
            {inferredFormat === 'DOCUMENT' && hasRealUrl && (
              <div className="p-3 flex items-center gap-2">
                 <FileText className="h-4 w-4 opacity-70" />
                 <span className="text-[10px] font-bold truncate">Template Document</span>
              </div>
            )}
          </div>
        )}
        <p className="text-[14.5px] leading-[1.45] font-medium whitespace-pre-wrap break-words">{fallbackBody}</p>
        {(template.footer?.enabled || template.footer?.text || template.footerText || footerComponent?.text) && (
           <p className="text-[11px] opacity-60 mt-1 font-medium break-words">{template.footer?.text || template.footerText || footerComponent?.text}</p>
        )}
      </div>
      
      {buttons.length > 0 && (
        <div className="border-t border-black/5 flex flex-col divide-y divide-black/5 bg-black/5 dark:bg-white/5 rounded-b-2xl">
          {buttons.map((btn: any, idx: number) => (
            <button
              key={`${btn.type || 'btn'}-${btn.text || 'action'}-${idx}`}
              onClick={() => {
                if (btn.type === 'URL' && btn.url) window.open(btn.url, '_blank');
                else if (btn.type === 'PHONE_NUMBER' && (btn.phone_number || btn.phoneNumber)) window.open(`tel:${btn.phone_number || btn.phoneNumber}`);
              }}
              className="w-full py-3 px-4 text-[13px] font-black uppercase tracking-widest text-sky-500 hover:bg-black/5 transition-colors flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              {btn.type === 'URL' && <ExternalLink className="h-3.5 w-3.5" />}
              {btn.type === 'PHONE_NUMBER' && <Phone className="h-3.5 w-3.5" />}
              {btn.text || btn.title || btn.label || 'Action'}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

const InteractiveRenderer = React.memo(({ message }: { message: Message }) => {
  const interactive = (message as any).meta?.interactiveReply;
  if (!interactive) return <p className="text-[14.5px] leading-[1.45] font-medium break-words">{getMessageBody(message)}</p>;
  
  return (
    <div className="flex items-center gap-3 py-2 px-3 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5">
      <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
         <Zap className="h-4 w-4" />
      </div>
      <div>
        <p className="text-[9px] font-black uppercase tracking-widest opacity-50">Selection</p>
        <p className="text-[13px] font-bold">{interactive.title}</p>
      </div>
    </div>
  );
});

const FlowMessageRenderer = React.memo(({ message }: { message: Message }) => {
  const flow = (message as any).meta?.flow;
  const header = flow?.header;
  const body = flow?.body?.text || getMessageBody(message) || 'WhatsApp Flow';
  const footer = flow?.footer?.text;
  const buttonText = flow?.action?.parameters?.flow_cta || 'Open Form';

  return (
    <div className="space-y-0 -mx-3 -mb-3">
      <div className="px-3 pb-3">
        {header && header.type === 'text' && (
          <p className="font-bold text-sm mb-2">{header.text}</p>
        )}
        <p className="text-[14.5px] leading-[1.45] font-medium whitespace-pre-wrap">{body}</p>
        {footer && (
          <p className="text-[11px] opacity-60 mt-1 font-medium">{footer}</p>
        )}
      </div>
      <div className="border-t border-black/5 bg-black/5 dark:bg-white/5 rounded-b-2xl">
        <div className="w-full py-3.5 px-4 text-[12px] font-black uppercase tracking-[0.15em] text-sky-500 flex items-center justify-center gap-2">
          <Zap className="h-4 w-4 fill-sky-500/20" />
          {buttonText}
        </div>
      </div>
    </div>
  );
});

const FlowReplyRenderer = React.memo(({ message }: { message: Message }) => {
  const reply = (message as any).meta?.interactiveReply;
  const data = reply?.data || {};
  const entries = Object.entries(data).filter(([key]) => !['flow_token', 'temp_id'].includes(key));

  if (entries.length === 0) {
    return <p className="text-[14.5px] leading-[1.45] font-medium italic opacity-60">Flow submitted (no data)</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 pb-2 border-b border-black/5 dark:border-white/5">
         <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-500">
            <CheckCheck className="h-3.5 w-3.5" />
         </div>
         <span className="text-[10px] font-black uppercase tracking-widest opacity-50">Flow Submission</span>
      </div>
      <div className="grid grid-cols-1 gap-2.5">
        {entries.map(([key, value]) => (
          <div key={key} className="flex flex-col gap-0.5">
            <span className="text-[9px] font-black uppercase tracking-tighter opacity-40 leading-none">
              {key.replace(/_/g, ' ')}
            </span>
            <span className="text-[13px] font-bold leading-tight break-words">
              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});

const ContactsRenderer = React.memo(({ message }: { message: Message }) => {
  const contacts = (message as any).meta?.contacts || [];
  if (!contacts.length) return <p className="text-[14.5px] leading-[1.45] font-medium break-words">{getMessageBody(message)}</p>;
  
  const contact = contacts[0];
  const name = contact.name?.formatted_name || contact.name?.first_name || 'Contact';
  const phone = contact.phones?.[0]?.phone || 'No phone number';
  
  return (
    <div className="space-y-0 -mx-3 -mb-3 bg-white/50 dark:bg-black/20 rounded-b-2xl overflow-hidden border-t border-black/5">
      <div className="p-4 flex items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
           <User className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
           <p className="text-[15px] font-bold truncate leading-tight tracking-tight">{name}</p>
           <p className="text-[12px] opacity-60 truncate font-medium">{phone}</p>
        </div>
      </div>
      <div className="border-t border-black/5 flex divide-x divide-black/5">
         <button
            onClick={() => { const p = String(phone).replace(/\D/g, ''); if (p) window.open(`https://wa.me/${p}`, '_blank'); }}
            className="flex-1 py-3.5 text-[11px] font-black uppercase tracking-widest text-sky-500 hover:bg-black/5 transition-colors">
            Message
         </button>
         <button
            onClick={() => { if (phone && phone !== 'No phone number') window.open(`tel:${phone}`); }}
            className="flex-1 py-3.5 text-[11px] font-black uppercase tracking-widest text-sky-500 hover:bg-black/5 transition-colors">
            View
         </button>
      </div>
    </div>
  );
});

const LocationRenderer = React.memo(({ message }: { message: Message }) => {
  const location = (message as any).meta?.location;
  if (!location) return <p className="text-[14.5px] leading-[1.45] font-medium break-words">{getMessageBody(message)}</p>;
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;
  
  return (
    <div className="space-y-0 -mx-3 -mb-3">
      <div className="overflow-hidden h-[160px] relative bg-slate-100 dark:bg-slate-900">
         <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 0.5px, transparent 0.5px)', backgroundSize: '10px 10px' }} />
         <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center text-primary animate-bounce">
              <MapPin className="h-6 w-6" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30">Location Active</p>
         </div>
         <div className="absolute bottom-3 left-3 right-3 p-3 bg-white/95 dark:bg-[#111b21]/95 backdrop-blur-md rounded-2xl shadow-xl border border-black/5">
            <p className="text-[13px] font-bold leading-tight truncate tracking-tight">{location.name || 'Shared Location'}</p>
            <p className="text-[10px] opacity-60 truncate mt-1 font-medium italic">{location.address || 'Open in maps for details'}</p>
         </div>
      </div>
      <button 
        onClick={() => window.open(mapUrl, '_blank')}
        className="w-full py-4 text-[11px] font-black uppercase tracking-[0.2em] text-sky-500 hover:bg-black/5 transition-colors border-t border-black/5 bg-white/50 dark:bg-black/20"
      >
        Explore on Google Maps
      </button>
    </div>
  );
});

const PaymentRenderer = React.memo(({ message }: { message: Message }) => {
  const router = useRouter();
  const payment = (message as any).meta?.payment || {};
  const amount = payment.amount || (message as any).amount;
  const currency = payment.currency || (message as any).currency || 'BRL';
  const status = payment.status || (message as any).status;
  
  return (
    <div className="space-y-0 -mx-3 -mb-3 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-b-2xl overflow-hidden border-t border-emerald-500/10">
      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
           <div className="h-10 w-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-600">
              <DollarSign className="h-5 w-5" />
           </div>
           <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md">
              {status || 'Pending'}
           </Badge>
        </div>
        <div>
           <p className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-0.5">Payment Request</p>
           <h4 className="text-xl font-black tracking-tighter text-emerald-600">
             {currency} {amount?.toLocaleString() || '0,00'}
           </h4>
        </div>
      </div>
      <button onClick={() => { router.push('/commerce/orders'); }} className="w-full py-3.5 text-[11px] font-black uppercase tracking-[0.2em] bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-lg active:scale-[0.98]">
         View Transaction Details
      </button>
    </div>
  );
});

const MessageBubble = React.memo(({ message, isFirstInGroup, onReact, onRetryMedia, user }: { message: Message, isFirstInGroup: boolean, onReact?: any, onRetryMedia?: any, user?: any }) => {
  const isOutbound = message.direction === 'outbound';
  const isNote = message.type === 'note' || (message as any).isInternalNote;
  const isTemplate = message.type === 'template';
  const isInteractive = message.type === 'interactive';
  const isLocation = message.type === 'location';
  const isAudio = message.type === 'audio';
  const isSticker = message.type === 'sticker';
  const isPayment = ['payment', 'pix', 'boleto'].includes(message.type);
  const mediaTypes = ['image', 'video', 'audio', 'document', 'sticker'];
  const isMediaType = mediaTypes.includes(message.type as string);
  const displayBody = getMessageBody(message);
  const normalizedBody = displayBody.trim();
  const isAutoMediaPlaceholder = /^\[(image|video|audio|document|sticker)\]$/i.test(normalizedBody);
  const shouldRenderBody = !isSticker && !isPayment && normalizedBody.length > 0 && (!isMediaType || !isAutoMediaPlaceholder) && !isLocation && message.type !== 'contacts';
  const canRetryFailedMedia = isOutbound && message.status === 'failed' && isMediaType && !!(message as any)?.meta?.localUpload?.canRetry;
  const hasStableMessageId = Boolean(message.whatsappMessageId || /^[a-f\d]{24}$/i.test(String(message._id || '')));

  const parseDateSafe = (value: any) => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  return (
    <div className={`flex w-full ${isOutbound ? 'justify-end' : 'justify-start'} mb-1 group px-4 ${isFirstInGroup ? 'mt-4' : 'mt-0.5'}`}>
      <div 
        className={`
          max-w-[85%] md:max-w-[65%] rounded-2xl p-3 shadow-none relative 
          ${isNote ? 'bg-amber-100 dark:bg-amber-900/40 border border-amber-500/20' : 
            isOutbound ? 'bg-[#dcf8c6] dark:bg-[#005c4b] text-foreground' : 
            'bg-white dark:bg-[#202c33] text-foreground border border-black/5 dark:border-white/5'}
          ${isSticker ? 'bg-transparent shadow-none border-none !p-0' : ''}
          ${isFirstInGroup && !isNote && !isSticker ? (isOutbound ? 'rounded-tr-none' : 'rounded-tl-none') : ''}
        `}
      >
        {isFirstInGroup && !isNote && !isSticker && (
           <div className={`absolute top-0 w-3 h-4 ${isOutbound ? '-right-2 bg-[#dcf8c6] dark:bg-[#005c4b]' : '-left-2 bg-white dark:bg-[#202c33]'}`} style={{ clipPath: isOutbound ? 'polygon(0 0, 0 100%, 100% 0)' : 'polygon(100% 0, 100% 100%, 0 0)' }} />
        )}
        {isNote && (
           <div className="flex items-center gap-1.5 mb-2 opacity-60 text-amber-900 dark:text-amber-200">
              <StickyNote className="h-3.5 w-3.5" />
              <span className="text-[10px] font-black uppercase tracking-widest">Internal Note</span>
           </div>
        )}
        {message.media && !isTemplate && (
          <div className={`mb-2 rounded-xl overflow-hidden ${isSticker ? 'shadow-none' : 'bg-black/5 dark:bg-white/5 border border-black/5'}`}>
            {message.type === 'image' && <img src={message.media.url || message.media.link} alt="Shared" className="w-full h-auto max-h-[350px] object-cover cursor-zoom-in group-hover:opacity-95 transition-opacity" />}
            {message.type === 'video' && <video src={message.media.url || message.media.link} controls className="w-full h-auto max-h-[350px]" />}
          </div>
        )}
        {isTemplate ? <TemplateRenderer message={message} /> : 
         isInteractive && (message as any).meta?.flow ? <FlowMessageRenderer message={message} /> :
         isInteractive && (message as any).meta?.interactiveReply?.type === 'nfm_reply' ? <FlowReplyRenderer message={message} /> :
         isInteractive ? <InteractiveRenderer message={message} /> : 
         isLocation ? <LocationRenderer message={message} /> : 
         message.type === 'contacts' ? <ContactsRenderer message={message} /> : 
         isPayment ? <PaymentRenderer message={message} /> : (
          shouldRenderBody && (
            <div className="space-y-1">
              {message.subject && (
                <div className="px-2 py-1 rounded-md bg-black/5 dark:bg-white/5 border-l-2 border-primary mb-1">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-50">Subject</p>
                  <p className="text-[13px] font-bold truncate">{message.subject}</p>
                </div>
              )}
              <p className="text-[14.5px] leading-[1.45] font-medium whitespace-pre-wrap break-words">{displayBody}</p>
            </div>
          )
        )}
        <div className="flex items-center gap-1.5 mt-1 justify-end opacity-50">
          {message.sentBy && typeof message.sentBy === 'object' && <span className="text-[9px] font-black uppercase tracking-tighter mr-1">{(message.sentBy as any).name}</span>}
          <span className="text-[10px] font-bold tracking-tighter">
            {(() => {
              const createdAt = parseDateSafe(message.createdAt);
              return createdAt ? createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';
            })()}
          </span>
          {isOutbound && <StatusIcon status={message.status!} direction="outbound" />}
        </div>
        <ReactionsOverlay reactions={message.meta?.reactions} align={isOutbound ? 'right' : 'left'} />
         {hasStableMessageId && (
          <div className={`absolute top-0 ${isOutbound ? '-left-10' : '-right-10'} opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1`}>
           <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-background/95 border border-border/50 shadow-lg backdrop-blur-md hover:bg-primary/5">
                  <Smile className="h-4.5 w-4.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
             <DropdownMenuContent side={isOutbound ? "left" : "right"} sideOffset={12} align="center" className="rounded-full border-border/50 bg-background/95 p-2 shadow-2xl backdrop-blur-xl">
               <div className="grid w-full grid-cols-6 gap-2">
                 {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                    <DropdownMenuItem key={emoji} className="h-10 w-10 rounded-full p-0 flex items-center justify-center cursor-pointer text-xl" onClick={() => onReact?.(message, emoji)}>
                      {emoji}
                    </DropdownMenuItem>
                 ))}
               </div>
              </DropdownMenuContent>
           </DropdownMenu>
          </div>
         )}
      </div>
    </div>
  );
}, (prev, next) => {
  return prev.message.status === next.message.status && 
         prev.isFirstInGroup === next.isFirstInGroup && 
         getMessageBody(prev.message) === getMessageBody(next.message) &&
         prev.message.type === next.message.type &&
         JSON.stringify(prev.message.meta?.reactions) === JSON.stringify(next.message.meta?.reactions);
});

interface MessageThreadProps {
  messages: Message[];
  isLoading: boolean;
  currentUser: any;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
  onRetryMedia?: (message: Message) => void;
  onReact?: (message: Message, emoji: string) => void;
}

export default function MessageThread({ 
  messages, 
  isLoading, 
  currentUser,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  onRetryMedia,
  onReact
}: MessageThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastScrollHeight = useRef<number>(0);
  const isFetchingMore = useRef<boolean>(false);
  const [dates, setDates] = useState({ today: '', yesterday: '' });
  const [activeDateLabel, setActiveDateLabel] = useState('');

  useEffect(() => {
    setDates({
      today: new Date().toDateString(),
      yesterday: new Date(Date.now() - 86400000).toDateString()
    });
  }, []);

  const renderedMessages = React.useMemo(() => {
    const clonedMessages = messages.map((message) => ({
      ...message,
      meta: message.meta
        ? {
            ...message.meta,
            reactions: message.meta.reactions ? { ...message.meta.reactions } : undefined
          }
        : undefined
    }));

    const seenMessages = new Set<string>();
    const uniqueMessages = clonedMessages.filter((message) => {
      const dedupeKey = String(
        message._id ||
        message.whatsappMessageId ||
        `${message.direction || 'dir'}-${message.type || 'type'}-${message.createdAt || 'created'}-${getMessageBody(message)}`
      );

      if (seenMessages.has(dedupeKey)) {
        return false;
      }

      seenMessages.add(dedupeKey);
      return true;
    });

    const messageIndex = new Map<string, any>();

    uniqueMessages.forEach((message) => {
      if (message._id) messageIndex.set(String(message._id), message);
      if (message.whatsappMessageId) messageIndex.set(String(message.whatsappMessageId), message);
    });

    uniqueMessages.forEach((message) => {
      if (message.type !== 'reaction') return;

      const reactionMeta = message.meta?.reaction || {};
      const targetMessageId =
        message.meta?.reactedTo ||
        reactionMeta.message_id ||
        reactionMeta.messageId ||
        reactionMeta.id ||
        message.repliedTo ||
        null;

      if (!targetMessageId) return;

      const targetMessage = messageIndex.get(String(targetMessageId));
      if (!targetMessage) return;

      if (!targetMessage.meta) targetMessage.meta = {};
      if (!targetMessage.meta.reactions) targetMessage.meta.reactions = {};

      const reactionKey = String(message._id || message.whatsappMessageId || `${targetMessageId}-${message.createdAt}`);
      targetMessage.meta.reactions[reactionKey] = {
        emoji: getMessageBody(message) || message.meta?.emoji || reactionMeta.emoji || '👍',
        timestamp: message.createdAt,
        reactionMessageId: message._id,
        reactedBy: message.sentBy || null
      };
    });

    return uniqueMessages.filter((message) => message.type !== 'reaction');
  }, [messages]);

  const parseDateSafe = (value: any) => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const getMessageDateLabel = React.useCallback((createdAt: any) => {
    const dateObj = parseDateSafe(createdAt) || new Date('2000-01-01');
    const msgDate = dateObj.toDateString();

    if (msgDate === dates.today) return 'Today';
    if (msgDate === dates.yesterday) return 'Yesterday';

    return dateObj.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }, [dates.today, dates.yesterday]);

  const updateActiveDateLabel = React.useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;

    const messageNodes = Array.from(
      container.querySelectorAll<HTMLElement>('[data-message-date-label]')
    );

    if (messageNodes.length === 0) {
      setActiveDateLabel('');
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const anchorY = containerRect.top + 56;
    let selectedNode = messageNodes[0];
    let smallestDistance = Number.POSITIVE_INFINITY;

    for (const node of messageNodes) {
      const rect = node.getBoundingClientRect();

      if (rect.bottom < containerRect.top) {
        selectedNode = node;
        continue;
      }

      if (rect.top <= anchorY && rect.bottom >= containerRect.top) {
        selectedNode = node;
        break;
      }

      const distance = Math.abs(rect.top - anchorY);
      if (distance < smallestDistance) {
        smallestDistance = distance;
        selectedNode = node;
      }
    }

    const nextLabel = selectedNode.dataset.messageDateLabel || '';
    setActiveDateLabel((currentLabel) => currentLabel === nextLabel ? currentLabel : nextLabel);
  }, []);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  // 1. Handle initial scroll to bottom and scroll anchoring for "Load More"
  useEffect(() => {
    if (!scrollRef.current) return;

    if (isFetchingMore.current) {
      // Maintaining scroll position after loading older messages (prepending)
      const currentHeight = scrollRef.current.scrollHeight;
      const heightDiff = currentHeight - lastScrollHeight.current;
      scrollRef.current.scrollTop = heightDiff;
      isFetchingMore.current = false;
    } else if (!isLoading && messages.length > 0) {
      // Initial load or new message at bottom
      scrollToBottom();
    }
  }, [isLoading, messages]);

  useEffect(() => {
    const container = scrollRef.current;

    if (isLoading || renderedMessages.length === 0 || !container) {
      setActiveDateLabel('');
      return;
    }

    container.addEventListener('scroll', updateActiveDateLabel, { passive: true });
    window.addEventListener('resize', updateActiveDateLabel);

    const frame = window.requestAnimationFrame(updateActiveDateLabel);

    return () => {
      container.removeEventListener('scroll', updateActiveDateLabel);
      window.removeEventListener('resize', updateActiveDateLabel);
      window.cancelAnimationFrame(frame);
    };
  }, [dates.today, dates.yesterday, isLoading, renderedMessages.length, updateActiveDateLabel]);

  const handleLoadMore = () => {
    if (scrollRef.current) {
      lastScrollHeight.current = scrollRef.current.scrollHeight;
      isFetchingMore.current = true;
    }
    onLoadMore?.();
  };

  const renderedItems: any[] = [];
  let lastSender: any = null;
  let lastDate: any = null;

  renderedMessages.forEach((msg, idx) => {
    const parsedCreatedAt = parseDateSafe(msg.createdAt);
    const msgDate = parsedCreatedAt ? parsedCreatedAt.toDateString() : `unknown-${idx}`;
    const senderId = msg.direction === 'outbound' ? (msg.sentBy?._id || 'agent') : 'contact';
    const isSystem = msg.type === 'system' || (msg as any).isSystem;
    const dateLabel = getMessageDateLabel(msg.createdAt);

    if (msgDate !== lastDate) {
      lastDate = msgDate;
      lastSender = null;
    }

    const isFirstInGroup = senderId !== lastSender || isSystem;
    const messageKey = [
      msg._id ? String(msg._id) : null,
      msg.whatsappMessageId ? String(msg.whatsappMessageId) : null,
      msg.createdAt ? String(msg.createdAt) : null,
      `idx-${idx}`
    ]
      .filter(Boolean)
      .join('-');

    renderedItems.push(
      <div key={messageKey} data-message-date-label={dateLabel}>
        <MessageBubble
          message={msg}
          isFirstInGroup={isFirstInGroup}
          onReact={onReact}
          onRetryMedia={onRetryMedia}
          user={currentUser}
        />
      </div>
    );
    
    if (!isSystem) lastSender = senderId;
    else lastSender = null;
  });

  return (
    <div className="flex flex-col h-full bg-slate-50/50 dark:bg-transparent relative">
      {!isLoading && activeDateLabel && (
        <div className="pointer-events-none absolute left-0 right-0 top-3 z-20 flex justify-center">
          <span className="rounded-lg border border-border/40 bg-background/90 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground shadow-sm backdrop-blur">
            {activeDateLabel}
          </span>
        </div>
      )}
      <div 
        className="flex-1 px-6 pb-6 pt-12 space-y-2 relative z-0 overflow-y-auto custom-scrollbar"
        ref={scrollRef}
      >
          {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full space-y-4 opacity-50">
             <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
          ) : renderedMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
             <div className="h-16 w-16 rounded-3xl bg-primary/5 flex items-center justify-center text-primary/30">
                <ImageIcon className="h-8 w-8" />
             </div>
             <div>
                <h3 className="text-sm font-black text-foreground">No messages yet</h3>
                <p className="text-[11px] text-muted-foreground font-medium">Send a message to start the conversation.</p>
             </div>
          </div>
        ) : (
          <>
            {hasNextPage && (
              <div className="flex justify-center pb-8 pt-2">
                <Button 
                   variant="outline" 
                   size="sm" 
                   onClick={handleLoadMore}
                   disabled={isFetchingNextPage}
                   className="rounded-full bg-background/50 backdrop-blur-md border-border/50 text-[10px] font-black uppercase tracking-widest h-9 px-6 hover:bg-primary/5 hover:text-primary transition-all shadow-premium-sm"
                >
                  {isFetchingNextPage ? (
                    <><Loader2 className="h-3 w-3 animate-spin mr-2" /> Loading History...</>
                  ) : (
                    'Load More History'
                  )}
                </Button>
              </div>
            )}
            {renderedItems}
          </>
        )}
      </div>
    </div>
  );
}
