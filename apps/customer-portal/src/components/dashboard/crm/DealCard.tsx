"use client";

import React, { useMemo } from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { 
  MoreVertical, 
  DollarSign, 
  Clock, 
  User, 
  MessageSquare,
  AlertCircle,
  Zap,
  Phone,
  BarChart2
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Deal } from '@/lib/api/crm';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from 'date-fns';

interface DealCardProps {
  deal: Deal;
  index: number;
  onClick: (deal: Deal) => void;
  onEdit?: (deal: Deal) => void;
  onDelete?: (deal: Deal) => void;
}

const getPriorityStyles = (priority: string) => {
  switch (priority?.toLowerCase()) {
    case 'urgent': return 'bg-red-500/10 text-red-600 border-red-500/20';
    case 'high': return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
    case 'medium': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    case 'low': return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
    default: return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
  }
};

const safeText = (value: unknown, fallback = '') =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback;

const initialFor = (value: unknown, fallback = '?') =>
  safeText(value).charAt(0).toUpperCase() || fallback;

export const DealCard: React.FC<DealCardProps> = ({ deal, index, onClick, onEdit, onDelete }) => {
  const router = useRouter();
  const dealId = safeText(deal._id, `deal-${index}`);
  const dealTitle = safeText(deal.title, 'Untitled deal');
  const priority = safeText(deal.priority, 'medium');
  const currency = safeText(deal.currency, 'INR');
  const contactName = safeText(deal.contact?.name, 'Unknown Contact');
  const contactPhone = safeText(deal.contact?.phone);
  const assignedAgentName = safeText(deal.assignedAgent?.name);

  const { daysInStage, isCold } = useMemo(() => {
    const lastHistory = [...(deal.activityLog || [])].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
    const startTimestamp = lastHistory?.timestamp || deal.createdAt;
    if (!startTimestamp) {
      return { daysInStage: 0, isCold: false };
    }
    const start = new Date(startTimestamp);
    const diff = Math.floor((new Date().getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return {
      daysInStage: Number.isFinite(diff) ? Math.max(0, diff) : 0,
      isCold: diff >= 4
    };
  }, [deal.activityLog, deal.createdAt]);

  return (
    <Draggable draggableId={dealId} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className="mb-3 outline-none group/card"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ y: -4, boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)" }}
            className={cn(
               "bg-card border border-border/40 p-5 rounded-[28px] shadow-premium-sm transition-all cursor-pointer relative overflow-hidden",
               snapshot.isDragging ? "rotate-2 scale-105 shadow-premium-lg ring-2 ring-primary/40 z-50" : "",
               isCold ? "border-sky-500/40 shadow-[inset_0_0_12px_rgba(14,165,233,0.1)] hover:border-sky-500/60" : "hover:border-primary/30"
            )}
            onClick={() => onClick(deal)}
          >
            {/* Spotlight / Cold effect placeholder */}
            <div className={cn(
              "absolute top-0 right-0 w-24 h-24 blur-[40px] rounded-full -mr-12 -mt-12 pointer-events-none transition-colors duration-700",
              isCold ? "bg-sky-500/20" : "bg-primary/5"
            )} />

            <div className="space-y-4 relative z-10">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                     <Badge className={cn("text-[9px] font-black uppercase tracking-widest px-1.5 py-0 rounded-md border shadow-none", getPriorityStyles(priority))}>
                        {priority}
                     </Badge>
                     {isCold && (
                       <Badge className="bg-sky-500/10 text-sky-600 border-sky-500/20 text-[8px] font-black uppercase tracking-widest px-1.5 py-0 rounded-md">
                          Inactive
                       </Badge>
                     )}
                     {deal.probability && !isCold && (
                       <span className="text-[9px] font-black text-emerald-500 bg-emerald-500/10 px-1.5 py-0 rounded-md border border-emerald-500/20">
                         {deal.probability}%
                       </span>
                     )}
                  </div>
                  <h4 className="text-sm font-black text-foreground leading-tight tracking-tight group-hover/card:text-primary transition-colors">
                    {dealTitle}
                  </h4>
                </div>
                
                <div className="flex flex-col items-end gap-1 shrink-0">
                   <div className="flex items-center gap-1">
                      <div className="text-xs font-black tracking-tighter text-foreground flex items-center gap-0.5">
                         <span className="text-muted-foreground opacity-50 text-[10px] mr-1">{currency}</span>
                         {deal.value?.toLocaleString()}
                      </div>
                      
	                      <DropdownMenu>
	                         <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
	                            <Button variant="ghost" size="icon" aria-label={`Open actions for deal ${dealTitle}`} className="size-6 rounded-lg hover:bg-accent opacity-0 group-hover/card:opacity-100 transition-opacity">
	                               <MoreVertical className="size-3 text-muted-foreground" />
	                            </Button>
	                         </DropdownMenuTrigger>
                         <DropdownMenuContent align="end" className="w-[180px] rounded-2xl shadow-premium-lg border-border/40 p-2">
                            <DropdownMenuItem 
                              className="rounded-xl font-bold py-2.5 cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEdit?.(deal);
                              }}
                            >
                               Edit Details
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="rounded-xl font-bold py-2.5 text-destructive cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDelete?.(deal);
                              }}
                            >
                               Archive Deal
                            </DropdownMenuItem>
                         </DropdownMenuContent>
                      </DropdownMenu>
                   </div>
                   <div className={cn(
                     "flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest",
                     isCold ? "text-sky-500" : "text-muted-foreground/60"
                   )}>
                      {isCold ? <AlertCircle className="size-2.5" /> : <Clock className="size-2.5" />}
                      {daysInStage === 0 ? 'Today' : `${daysInStage}d ago`}
                   </div>
                </div>
              </div>

              {/* Progress Visual */}
              <div className="h-1 w-full bg-muted/30 rounded-full overflow-hidden">
                <motion.div 
                   initial={{ width: 0 }}
                   animate={{ width: `${deal.probability || 20}%` }}
                   className={cn(
                     "h-full rounded-full transition-colors duration-500",
                     isCold ? "bg-sky-500/40" : "bg-primary/40 shadow-[0_0_8px_rgba(var(--primary),0.3)]"
                   )}
                />
              </div>

              {/* Contact & Activity */}
              <div className="flex items-center justify-between pt-1">
                 <div className="flex items-center gap-2 min-w-0">
                    <div className="relative">
                       <Avatar className="size-7 rounded-xl ring-2 ring-background shadow-premium-sm transition-transform group-hover/card:scale-110">
                         <AvatarImage src={deal.contact?.avatar} />
                         <AvatarFallback className="text-[10px] font-black bg-gradient-to-br from-primary/20 to-primary/5 text-primary">
                           {initialFor(contactName)}
                         </AvatarFallback>
                       </Avatar>
                       {!isCold && <div className="absolute -top-1 -right-1 size-3 bg-emerald-500 border-2 border-background rounded-full" />}
                       {isCold && <div className="absolute -top-1 -right-1 size-3 bg-sky-500 border-2 border-background rounded-full" />}
                    </div>
                    <div className="min-w-0">
                       <p className="text-[10px] font-black truncate leading-none mb-0.5">{contactName}</p>
                       <p className="text-[9px] font-medium text-muted-foreground/60 truncate italic leading-none">{contactPhone || 'No phone'}</p>
                    </div>
                 </div>

                 <div className="flex -space-x-2">
                    <span className="text-[8px] font-bold text-muted-foreground/30 uppercase tracking-tighter mr-2">Est. Apr 22</span>
                    {deal.assignedAgent && (
                       <Avatar className="size-6 rounded-lg ring-2 ring-background shadow-sm border border-border/40">
                          <AvatarFallback className="text-[8px] font-black bg-muted text-muted-foreground">
                             {initialFor(assignedAgentName)}
                          </AvatarFallback>
                       </Avatar>
                    )}
                 </div>
              </div>

              {/* Quick Actions Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-border/20">
                 <div className="flex items-center gap-2.5">
                    <div className="flex items-center gap-1 text-[9px] font-bold text-muted-foreground/50">
                       <MessageSquare className="size-3" />
                       {deal.notes?.length || 0}
                    </div>
                    <div className={cn(
                      "flex items-center gap-1 text-[9px] font-bold",
                      isCold ? "text-sky-500" : "text-muted-foreground/50"
                    )}>
                       <Zap className="size-3" />
                       {isCold ? 'Stalled' : 'Active'}
                    </div>
                 </div>
                 
                  <div className="flex items-center gap-1 opacity-0 group-hover/card:opacity-100 transition-all translate-y-2 group-hover/card:translate-y-0">
                    <Button variant="ghost" size="icon" onClick={(e) => {
                       e.stopPropagation();
                       const phone = contactPhone.replace(/\D/g, '');
                       if (phone) window.open(`https://wa.me/${phone}`, '_blank');
	                    }} className="size-7 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-600 transition-colors" title="Send WhatsApp" aria-label={`Send WhatsApp to ${contactName || dealTitle}`}>
	                       <MessageSquare className="size-3" />
	                    </Button>
                    <Button variant="ghost" size="icon" onClick={(e) => {
                       e.stopPropagation();
                       const phone = contactPhone;
                       if (phone) window.open(`tel:${phone}`);
	                    }} className="size-7 rounded-lg hover:bg-blue-500/10 hover:text-blue-600 transition-colors" title="Call contact" aria-label={`Call ${contactName || dealTitle}`}>
	                       <Phone className="size-3" />
	                    </Button>
                    <Button variant="ghost" size="icon" onClick={(e) => {
                       e.stopPropagation();
                       router.push('/crm/reports');
	                    }} className="size-7 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors" title="View Analytics" aria-label={`View analytics for ${dealTitle}`}>
	                       <BarChart2 className="size-3" />
	                    </Button>
                 </div>
              </div>
              
              {/* Last Activity Pulse - Premium Indicator */}
              {daysInStage === 0 && (
                <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 shadow-sm animate-in fade-in slide-in-from-left-2 duration-700">
                  <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[8px] font-black uppercase tracking-widest text-emerald-600">Active Now</span>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </Draggable>
  );
};
