"use client";

import React from 'react';
import { 
  MoreHorizontal, 
  MessageSquare, 
  Target, 
  Calendar,
  User,
  BadgeDollarSign
} from 'lucide-react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Deal, Pipeline } from '@/lib/api/crm';
import { format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { updateDealStage } from '@/lib/api/crm';

interface PipelineListViewProps {
  deals: Deal[];
  pipeline: Pipeline;
  onDealClick: (deal: Deal) => void;
  onEditDeal?: (deal: Deal) => void;
  onDeleteDeal?: (deal: Deal) => void;
  currency: string;
}

export const PipelineListView: React.FC<PipelineListViewProps> = ({ 
  deals, 
  pipeline, 
  onDealClick,
  onEditDeal,
  onDeleteDeal,
  currency 
}) => {
  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'urgent': return 'bg-red-500/10 text-red-600 border-red-500/20';
      case 'high': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      case 'medium': return 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20';
      default: return 'bg-muted/50 text-muted-foreground border-border/50';
    }
  };

  const getStageTitle = (stageId: string) => {
    return pipeline.stages.find(s => s.id === stageId)?.title || stageId;
  };

  const queryClient = useQueryClient();

  const handleMessage = (deal: Deal) => {
    const phone = String(deal.contact?.phone || '').replace(/\D/g, '');
    if (phone) window.open(`https://wa.me/${phone}`, '_blank');
    else toast.error('No phone number on this deal contact');
  };

  const handleMarkWon = async (deal: Deal) => {
    const wonStage = [...pipeline.stages].reverse().find((s: any) => (s as any).isFinal) || pipeline.stages[pipeline.stages.length - 1];
    if (!wonStage) return;
    try {
      await updateDealStage(deal._id, wonStage.id);
      toast.success(`Deal moved to ${wonStage.title}`);
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update deal');
    }
  };

  return (
    <div className="mx-6 bg-card rounded-[32px] border border-border/40 overflow-hidden shadow-premium-sm">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-b border-border/40 bg-muted/20">
            <TableHead className="w-[300px] px-8 py-5 text-[10px] font-black uppercase tracking-widest">Deal & Contact</TableHead>
            <TableHead className="px-8 py-5 text-[10px] font-black uppercase tracking-widest">Stage</TableHead>
            <TableHead className="px-8 py-5 text-[10px] font-black uppercase tracking-widest">Value</TableHead>
            <TableHead className="px-8 py-5 text-[10px] font-black uppercase tracking-widest">Priority</TableHead>
            <TableHead className="px-8 py-5 text-[10px] font-black uppercase tracking-widest">Assignee</TableHead>
            <TableHead className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {deals.map((deal, index) => (
            <TableRow 
              key={deal._id || index} 
              className="group hover:bg-muted/10 transition-colors border-b border-border/20 cursor-pointer"
              onClick={() => onDealClick(deal)}
            >
              <TableCell className="px-8 py-5">
                <div className="flex items-center gap-4">
                  <div className="size-10 rounded-2xl bg-primary/5 flex items-center justify-center ring-1 ring-primary/10">
                    <Target className="size-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-black text-sm tracking-tight truncate">{deal.title}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mt-0.5">
                      <User className="size-3" /> {deal.contact?.name || 'Unknown Contact'}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="px-8 py-5">
                <Badge variant="outline" className="rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-widest border-border/60 bg-background/50">
                  {getStageTitle(deal.stage)}
                </Badge>
              </TableCell>
              <TableCell className="px-8 py-5">
                <div className="flex items-center gap-1.5">
                  <BadgeDollarSign className="size-4 text-emerald-500" />
                  <p className="font-black text-sm tracking-tighter">
                    {currency === 'USD' ? '$' : '₹'}{deal.value?.toLocaleString() || 0}
                  </p>
                </div>
              </TableCell>
              <TableCell className="px-8 py-5">
                <Badge className={cn("rounded-lg px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border shadow-none", getPriorityColor(deal.priority))}>
                  {deal.priority}
                </Badge>
              </TableCell>
              <TableCell className="px-8 py-5">
                {deal.assignedAgent ? (
                  <div className="flex items-center gap-2">
                    <Avatar className="size-6 rounded-lg ring-1 ring-border">
                      <AvatarFallback className="text-[10px] font-black">{deal.assignedAgent.name?.charAt(0) || '?'}</AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-bold truncate">{deal.assignedAgent.name}</span>
                  </div>
                ) : (
                  <span className="text-xs font-bold text-muted-foreground opacity-40">Unassigned</span>
                )}
              </TableCell>
              <TableCell className="px-8 py-5 text-right" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-end gap-2">
	                  <Button variant="ghost" size="icon" onClick={() => handleMessage(deal)} aria-label={`Message ${deal.contact?.name || deal.title}`} className="size-10 rounded-xl hover:bg-primary/5 hover:text-primary">
	                    <MessageSquare className="size-4" />
	                  </Button>
	                  <DropdownMenu>
	                    <DropdownMenuTrigger asChild>
	                      <Button variant="ghost" size="icon" aria-label={`Open actions for deal ${deal.title}`} className="size-10 rounded-xl">
	                        <MoreHorizontal className="size-4" />
	                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-2xl border-border/40 shadow-premium-lg p-2">
                      <DropdownMenuItem 
                        className="rounded-xl font-bold py-2.5 px-4 cursor-pointer focus:bg-primary/5"
                        onClick={() => onEditDeal?.(deal)}
                      >
                        Edit Deal
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleMarkWon(deal)} className="rounded-xl font-bold py-2.5 px-4 cursor-pointer focus:bg-primary/5">Mark as Won</DropdownMenuItem>
                      <DropdownMenuItem 
                        className="rounded-xl font-bold py-2.5 px-4 cursor-pointer focus:bg-red-500/5 focus:text-red-500"
                        onClick={() => onDeleteDeal?.(deal)}
                      >
                        Archive Deal
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {deals.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="h-64 text-center">
                 <div className="flex flex-col items-center justify-center opacity-30">
                    <Target className="size-12 mb-4" />
                    <p className="text-xs font-black uppercase tracking-widest">No deals in this pipeline</p>
                 </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};
