"use client";

import React from 'react';
import { Droppable } from '@hello-pangea/dnd';
import { MoreHorizontal, Plus, TrendingUp, DollarSign } from 'lucide-react';
import { DealCard } from './DealCard';
import { Deal, Pipeline } from '@/lib/api/crm';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface PipelineColumnProps {
  stage: {
    id: string;
    title: string;
    color?: string;
  };
  deals: Deal[];
  currency: string;
  onDealClick: (deal: Deal) => void;
  onAddDeal?: (stageId: string) => void;
  onEditDeal?: (deal: Deal) => void;
  onDeleteDeal?: (deal: Deal) => void;
}

export const PipelineColumn: React.FC<PipelineColumnProps> = ({ 
  stage, 
  deals, 
  currency,
  onDealClick,
  onAddDeal,
  onEditDeal,
  onDeleteDeal
}) => {
  const totalValue = deals.reduce((sum, d) => sum + (d.value || 0), 0);
  const activeDeals = deals.filter(d => d.status === 'active');

  return (
    <div className="w-[340px] flex flex-col bg-muted/20 rounded-[36px] border border-border/30 overflow-hidden flex-shrink-0 h-full max-h-full group/column transition-all duration-300 hover:bg-muted/30">
      {/* Column Header */}
      <div className="p-6 flex flex-col gap-4 bg-background/30 backdrop-blur-md sticky top-0 z-20 border-b border-border/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
             <div 
                className="size-2.5 rounded-full shrink-0 shadow-[0_0_12px_currentColor]" 
                style={{ color: stage.color || '#6366f1' }}
             />
             <h3 className="text-[11px] font-bold uppercase tracking-[0.25em] text-foreground/80 truncate">{stage.title}</h3>
             <Badge variant="secondary" className="h-5 rounded-full px-2 text-[10px] bg-foreground text-background font-black border-none shrink-0 shadow-sm">
                {deals.length}
             </Badge>
          </div>
          <div className="flex items-center gap-1.5 opacity-0 group-hover/column:opacity-100 transition-opacity">
	            <Button 
	              variant="ghost" 
	              size="icon" 
	              className="h-8 w-8 rounded-xl bg-background/50 border border-border/20 shadow-sm"
	              onClick={() => onAddDeal?.(stage.id)}
	              aria-label={`Add deal to ${stage.title}`}
	            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-end justify-between">
           <div className="space-y-0.5">
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 leading-none">Total Value</p>
              <div className="flex items-baseline gap-1">
                 <span className="text-lg font-black tracking-tighter text-foreground">
                   {currency === 'USD' ? '$' : '₹'}{totalValue.toLocaleString()}
                 </span>
                 <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">{currency}</span>
              </div>
           </div>
           {deals.length > 0 && (
             <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-1 text-emerald-500">
                   <TrendingUp className="size-3" />
                   <span className="text-[10px] font-black tracking-widest">PROJ: 84%</span>
                </div>
                <div className="h-1 w-20 bg-muted/60 rounded-full overflow-hidden">
                   <div className="h-full bg-emerald-500 w-[84%] rounded-full shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
                </div>
             </div>
           )}
        </div>
      </div>

      {/* Droppable Area */}
      <Droppable droppableId={stage.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "flex-1 px-3 py-6 overflow-y-auto custom-scrollbar transition-all duration-300 no-scrollbar",
              snapshot.isDraggingOver ? "bg-primary/[0.03] inner-shadow-lg" : ""
            )}
          >
            <div className="space-y-3 min-h-[200px] flex flex-col pb-10">
              {deals.map((deal, index) => (
                <DealCard 
                  key={deal._id} 
                  deal={deal} 
                  index={index} 
                  onClick={onDealClick}
                  onEdit={onEditDeal}
                  onDelete={onDeleteDeal}
                />
              ))}
              {provided.placeholder}
              
              {deals.length === 0 && !snapshot.isDraggingOver && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="h-40 border-2 border-dashed border-border/10 rounded-[32px] flex flex-col items-center justify-center opacity-30 hover:opacity-100 hover:border-primary/20 hover:bg-primary/5 transition-all cursor-pointer text-center p-6 group/placeholder"
                  onClick={() => onAddDeal?.(stage.id)}
                >
                  <div className="size-10 rounded-2xl bg-muted flex items-center justify-center mb-3 group-hover/placeholder:bg-primary group-hover/placeholder:text-primary-foreground transition-colors">
                    <Plus className="h-6 w-6" />
                  </div>
                  <p className="text-[11px] font-black uppercase tracking-[0.2em]">Add Deal</p>
                  <p className="text-[10px] font-medium text-muted-foreground mt-1 px-4 leading-relaxed opacity-60 group-hover/placeholder:opacity-100 italic">No deals in this stage yet</p>
                </motion.div>
              )}
            </div>
          </div>
        )}
      </Droppable>
    </div>
  );
};
