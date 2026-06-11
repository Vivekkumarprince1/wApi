"use client";

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  LayoutGrid, 
  List,
  ChevronRight,
  TrendingUp,
  Settings2,
  ChevronDown,
  BarChart3,
  Calendar,
  Zap,
  MoreVertical,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { toast } from 'sonner';

import { 
  fetchPipelines, 
  fetchDeals, 
  deleteDeal,
  updateDealStage, 
  Pipeline, 
  Deal 
} from '@/lib/api/crm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup
} from "@/components/ui/dropdown-menu";
import FlashLoader from '@/components/ui/flash-loader';
import { PipelineColumn } from '@/components/dashboard/crm/PipelineColumn';
import { PipelineListView } from '@/components/dashboard/crm/PipelineListView';
import { DealDetailSidebar } from '@/components/dashboard/crm/DealDetailSidebar';
import { DealDialog } from '@/components/dashboard/crm/DealDialog';
import { PipelineDialog } from '@/components/dashboard/crm/PipelineDialog';
import { PipelineAutomation } from '@/components/dashboard/crm/PipelineAutomation';
import { cn } from '@/lib/utils';

export default function PipelinePage() {
  const queryClient = useQueryClient();
  const [activePipelineId, setActivePipelineId] = useState<string | null>(null);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'board' | 'list' | 'automation'>('board');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Dialog States
  const [isDealDialogOpen, setIsDealDialogOpen] = useState(false);
  const [isPipelineDialogOpen, setIsPipelineDialogOpen] = useState(false);
  const [dealToEdit, setDealToEdit] = useState<Deal | undefined>(undefined);

  const { data: pipelinesResponse, isLoading: isPipelinesLoading } = useQuery({
    queryKey: ['pipelines'],
    queryFn: () => fetchPipelines()
  });

  const pipelines: Pipeline[] = pipelinesResponse || [];

  useEffect(() => {
    if (Array.isArray(pipelines) && pipelines.length > 0 && !activePipelineId) {
      setActivePipelineId(pipelines[0]._id);
    }
  }, [pipelines, activePipelineId]);

  const activePipeline = Array.isArray(pipelines) ? (pipelines.find(p => p._id === activePipelineId) || pipelines[0]) : undefined;

  const { data: dealsResponse, isLoading: isDealsLoading } = useQuery({
    queryKey: ['deals', activePipeline?._id],
    queryFn: () => fetchDeals({ pipelineId: activePipeline?._id }),
    enabled: !!activePipeline
  });

  const deals: Deal[] = dealsResponse || [];

  const selectedDeal = deals.find(d => d._id === selectedDealId);

  // Filtered deals
  const filteredDeals = deals.filter(deal => 
    deal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    deal.contact?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    deal.contact?.phone?.includes(searchQuery)
  );

  const moveMutation = useMutation({
    mutationFn: (payload: { id: string, stage: string }) => updateDealStage(payload.id, payload.stage),
    onMutate: async (newMove) => {
      await queryClient.cancelQueries({ queryKey: ['deals', activePipeline?._id] });
      const previousDeals = queryClient.getQueryData(['deals', activePipeline?._id]);
      
      queryClient.setQueryData(['deals', activePipeline?._id], (old: any) => {
        if (!old || !old.data) return old;
        return {
          ...old,
          data: old.data.map((d: any) => d._id === newMove.id ? { ...d, stage: newMove.stage } : d)
        };
      });

      return { previousDeals };
    },
    onError: (err: any, _, context) => {
      if (context?.previousDeals) {
        queryClient.setQueryData(['deals', activePipeline?._id], context.previousDeals);
      }
      toast.error(err.message || 'Move failed');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast.success('Deal stage updated');
    }
  });

  const deleteDealMutation = useMutation({
    mutationFn: (id: string) => deleteDeal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast.success('Deal archived successfully');
    }
  });

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    moveMutation.mutate({ id: draggableId, stage: destination.droppableId });
  };

  if (isPipelinesLoading) return <FlashLoader />;

  return (
    <div className="h-[calc(100vh-theme(spacing.20))] flex relative overflow-hidden bg-muted/[0.02]">
      <div className={cn(
        "flex-1 flex flex-col space-y-6 transition-all duration-500 overflow-hidden",
        selectedDealId ? "mr-[500px]" : "mr-0"
      )}>
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 px-8 pt-6">
          <div className="space-y-1">
            <div className="flex items-center gap-4">
               <h1 className="text-4xl font-black tracking-tight text-foreground">
                  Sales Pipeline
               </h1>
               <div className="h-8 w-[1px] bg-border/40 mx-2" />
               
               <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-10 px-4 rounded-xl bg-muted/20 hover:bg-muted font-black text-[11px] uppercase tracking-widest gap-2 flex items-center shadow-premium-sm border border-border/10">
                       <LayoutGrid className="size-3.5 text-primary" />
                       {activePipeline?.name || 'Secondary Pipeline'}
                       <ChevronDown className="size-3.5 opacity-40 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56 rounded-2xl p-2 shadow-premium-lg border-border/40" align="start">
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest px-3 py-2 text-muted-foreground/60">Switch Pipeline</DropdownMenuLabel>
                      {pipelines.map((p, index) => (
                        <DropdownMenuItem 
                          key={p._id || index} 
                          className={cn("rounded-xl py-2.5 font-bold mb-1", activePipelineId === p._id && "bg-primary/5 text-primary")}
                          onClick={() => setActivePipelineId(p._id)}
                        >
                           {p.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      className="rounded-xl py-2.5 font-bold gap-2 text-primary cursor-pointer"
                      onClick={() => setIsPipelineDialogOpen(true)}
                    >
                       <Plus className="size-4" /> Create New Pipeline
                    </DropdownMenuItem>
                  </DropdownMenuContent>
               </DropdownMenu>
            </div>
            <p className="text-muted-foreground text-sm font-medium opacity-60">Manage your deals workflows and track team performance across multiple channels.</p>
          </div>

          <div className="flex items-center gap-3">
             <div className="flex items-center gap-1.5 p-1 bg-muted/20 border border-border/10 rounded-2xl shadow-premium-sm mr-2">
                <Button 
                  onClick={() => setViewMode('board')}
                  variant="ghost" 
                  size="sm" 
                  className={cn("h-9 rounded-xl font-black text-[10px] uppercase tracking-widest px-4", viewMode === 'board' ? "bg-background shadow-premium-sm text-primary" : "text-muted-foreground opacity-40")}
                >
                  <LayoutGrid className="size-3.5 mr-2" /> Board
                </Button>
                <Button 
                  onClick={() => setViewMode('list')}
                  variant="ghost" 
                  size="sm" 
                  className={cn("h-9 rounded-xl font-black text-[10px] uppercase tracking-widest px-4", viewMode === 'list' ? "bg-background shadow-premium-sm text-primary" : "text-muted-foreground opacity-40")}
                >
                  <List className="size-3.5 mr-2" /> List
                </Button>
                <Button 
                  onClick={() => setViewMode('automation')}
                  variant="ghost" 
                  size="sm" 
                  className={cn("h-9 rounded-xl font-black text-[10px] uppercase tracking-widest px-4", viewMode === 'automation' ? "bg-background shadow-premium-sm text-primary" : "text-muted-foreground opacity-40")}
                >
                  <Zap className="size-3.5 mr-2 text-amber-500" /> Intelligence
                </Button>
             </div>
             
             <Button 
                onClick={() => {
                  setDealToEdit(undefined);
                  setIsDealDialogOpen(true);
                }}
                className="rounded-2xl h-12 px-8 font-black shadow-lg shadow-primary/25 bg-primary text-primary-foreground text-[10px] uppercase tracking-[0.2em] gap-2 group"
              >
                <Plus className="size-4 group-hover:rotate-90 transition-transform duration-500" /> New Deal
              </Button>
          </div>
        </div>

        {/* Action Bar / Filters */}
        <div className="flex flex-wrap items-center gap-4 px-8">
           <div className="relative flex-1 min-w-[300px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40" />
              <Input 
                placeholder="Search deals by title, contact or value..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-11 h-13 rounded-[24px] bg-card border-border/30 focus-visible:ring-primary/20 shadow-premium-sm font-medium"
              />
           </div>
           
           <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => setSearchQuery('')} className="rounded-2xl h-13 px-6 border-border/40 font-black text-[10px] uppercase tracking-widest bg-card hover:bg-muted shadow-premium-sm gap-2">
                 <Filter className="size-4 opacity-40" /> Reset Filters
              </Button>
              <Button variant="outline" onClick={() => setIsPipelineDialogOpen(true)} title="New pipeline" className="rounded-2xl h-13 px-5 border-border/40 bg-card hover:bg-muted shadow-premium-sm">
                 <Settings2 className="size-4 opacity-40" />
              </Button>
           </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden">
          {isDealsLoading ? (
            <div className="h-full flex flex-col items-center justify-center space-y-4">
               <FlashLoader />
               <p className="text-[10px] font-black uppercase tracking-widest opacity-20">Refreshing funnel data...</p>
            </div>
          ) : activePipeline ? (
            <AnimatePresence mode="wait">
              {viewMode === 'board' ? (
                <motion.div 
                  key="board"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="h-full overflow-hidden"
                >
                  <DragDropContext onDragEnd={onDragEnd}>
                    <div className="h-full overflow-x-auto no-scrollbar flex items-start gap-6 px-8 pb-10">
                      {activePipeline.stages.sort((a, b) => a.position - b.position).map((stage) => (
                        <PipelineColumn 
                          key={stage.id}
                          stage={stage}
                          deals={filteredDeals.filter(d => d.stage === stage.id)}
                          currency={activePipeline.name.includes('INR') ? 'INR' : 'USD'}
                          onDealClick={(deal) => setSelectedDealId(deal._id)}
                          onAddDeal={(stageId) => {
                            setDealToEdit(undefined);
                            setIsDealDialogOpen(true);
                          }}
                          onEditDeal={(deal) => {
                            setDealToEdit(deal);
                            setIsDealDialogOpen(true);
                          }}
                          onDeleteDeal={(deal) => {
                            if (confirm('Are you sure you want to archive this deal?')) {
                              deleteDealMutation.mutate(deal._id);
                            }
                          }}
                        />
                      ))}
                      
                      {/* Add Stage Visual */}
                      <button onClick={() => setIsPipelineDialogOpen(true)} className="w-[340px] h-[300px] border-4 border-dashed border-border/10 rounded-[40px] shrink-0 flex flex-col items-center justify-center opacity-10 hover:opacity-50 transition-all hover:border-primary/40 hover:bg-primary/5 group">
                         <div className="size-16 rounded-[24px] bg-foreground text-background flex items-center justify-center group-hover:scale-110 shadow-premium-lg transition-all duration-500">
                            <Plus className="size-8" />
                         </div>
                         <p className="mt-4 text-xs font-black uppercase tracking-widest">Create Stage</p>
                      </button>
                    </div>
                  </DragDropContext>
                </motion.div>
              ) : viewMode === 'list' ? (
                <motion.div 
                  key="list"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="h-full overflow-y-auto no-scrollbar pb-10"
                >
                  <PipelineListView 
                    deals={filteredDeals} 
                    pipeline={activePipeline} 
                    onDealClick={(deal) => setSelectedDealId(deal._id)}
                    onEditDeal={(deal) => {
                      setDealToEdit(deal);
                      setIsDealDialogOpen(true);
                    }}
                    onDeleteDeal={(deal) => {
                      if (confirm('Are you sure you want to archive this deal?')) {
                        deleteDealMutation.mutate(deal._id);
                      }
                    }}
                    currency={activePipeline.name.includes('INR') ? 'INR' : 'USD'}
                  />
                </motion.div>
              ) : viewMode === 'automation' ? (
                <motion.div 
                   key="automation"
                   initial={{ opacity: 0, y: 10 }}
                   animate={{ opacity: 1, y: 0 }}
                   exit={{ opacity: 0, y: -10 }}
                   className="h-full overflow-y-auto no-scrollbar px-8 pb-32"
                >
                   {activePipeline && <PipelineAutomation pipelineId={activePipeline._id} stages={activePipeline.stages} />}
                </motion.div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-20 space-y-8">
               <div className="size-32 rounded-[48px] bg-primary/5 flex items-center justify-center border-4 border-dashed border-primary/20 animate-pulse">
                  <TrendingUp className="size-12 text-primary opacity-30" />
               </div>
               <div className="space-y-4 max-w-md">
                 <h3 className="text-3xl font-black tracking-tight">Setup Your Funnel</h3>
                 <p className="text-muted-foreground font-semibold leading-relaxed">No pipelines were found for this workspace. Create your first conversion roadmap to start closing deals.</p>
               </div>
               <Button size="lg" onClick={() => setIsPipelineDialogOpen(true)} className="rounded-[24px] h-16 px-12 font-black shadow-2xl shadow-primary/30 text-primary-foreground text-[11px] uppercase tracking-widest">
                  Bootstrap Workspace CRM
               </Button>
            </div>
              )}
            </AnimatePresence>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-20 space-y-8">
               <div className="size-32 rounded-[48px] bg-primary/5 flex items-center justify-center border-4 border-dashed border-primary/20 animate-pulse">
                  <TrendingUp className="size-12 text-primary opacity-30" />
               </div>
               <div className="space-y-4 max-w-md">
                 <h3 className="text-3xl font-black tracking-tight">Setup Your Funnel</h3>
                 <p className="text-muted-foreground font-semibold leading-relaxed">No pipelines were found for this workspace. Create your first conversion roadmap to start closing deals.</p>
               </div>
               <Button size="lg" onClick={() => setIsPipelineDialogOpen(true)} className="rounded-[24px] h-16 px-12 font-black shadow-2xl shadow-primary/30 text-primary-foreground text-[11px] uppercase tracking-widest">
                  Bootstrap Workspace CRM
               </Button>
            </div>
          )}
        </div>
      </div>

      {/* Detail Sidebar - Senior UX Animation */}
      <AnimatePresence>
        {selectedDealId && selectedDeal && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className="fixed inset-y-0 right-0 w-[500px] z-[60] shadow-2xl"
          >
            <DealDetailSidebar 
              deal={selectedDeal} 
              onClose={() => setSelectedDealId(null)}
              onUpdate={() => queryClient.invalidateQueries({ queryKey: ['deals'] })}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <DealDialog 
        isOpen={isDealDialogOpen}
        onClose={() => {
          setIsDealDialogOpen(false);
          setDealToEdit(undefined);
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['deals'] });
        }}
        pipelines={pipelines}
        deal={dealToEdit}
      />

      <PipelineDialog 
        isOpen={isPipelineDialogOpen}
        onClose={() => setIsPipelineDialogOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['pipelines'] });
        }}
      />
    </div>
  );
}
