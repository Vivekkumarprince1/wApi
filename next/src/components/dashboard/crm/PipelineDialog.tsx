"use client";

import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  LayoutGrid, 
  Plus, 
  Trash2, 
  GripVertical,
  Layers,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { motion, Reorder } from 'framer-motion';
import FlashLoader from '@/components/ui/flash-loader';

interface PipelineDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface Stage {
  id: string;
  title: string;
  color: string;
  isFinal: boolean;
}

export const PipelineDialog: React.FC<PipelineDialogProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState('');
  const [stages, setStages] = useState<Stage[]>([
    { id: 'leads', title: 'Leads', color: '#6366f1', isFinal: false },
    { id: 'qualified', title: 'Qualified', color: '#3b82f6', isFinal: false },
    { id: 'proposal', title: 'Proposal', color: '#8b5cf6', isFinal: false },
    { id: 'won', title: 'Won', color: '#10b981', isFinal: true },
    { id: 'lost', title: 'Lost', color: '#ef4444', isFinal: true },
  ]);

  const addStage = () => {
    const newId = `stage_${Math.random().toString(36).substr(2, 5)}`;
    setStages([...stages, { id: newId, title: 'New Stage', color: '#94a3b8', isFinal: false }]);
  };

  const removeStage = (id: string) => {
    if (stages.length <= 1) {
      toast.error("Pipeline must have at least one stage");
      return;
    }
    setStages(stages.filter(s => s.id !== id));
  };

  const updateStage = (id: string, updates: Partial<Stage>) => {
    setStages(stages.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter a pipeline name");
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/crm/pipelines', {
        name,
        stages: stages.map((s, idx) => ({ ...s, position: idx }))
      });
      toast.success("Pipeline created successfully");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to create pipeline");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[620px] p-0 overflow-hidden rounded-[32px] border-none shadow-2xl">
        <form onSubmit={handleSubmit}>
          <div className="bg-gradient-to-br from-primary/5 via-background to-background p-8 space-y-8">
            <DialogHeader className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center shadow-premium-sm border border-primary/20 shrink-0">
                   <LayoutGrid className="size-6 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-black tracking-tight text-foreground">
                    Design Your Pipeline
                  </DialogTitle>
                  <DialogDescription className="text-xs font-semibold text-muted-foreground uppercase tracking-widest opacity-60">
                    Map your sales journey
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-6">
              {/* Name Section */}
              <div className="space-y-3">
                <Label htmlFor="pipe_name" className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50 px-1">Pipeline Identity</Label>
                <div className="relative group">
                   <Sparkles className="absolute left-5 top-1/2 -translate-y-1/2 size-4 text-primary opacity-40 group-focus-within:opacity-100 group-focus-within:scale-110 transition-all duration-300" />
                   <Input 
                    id="pipe_name"
                    placeholder="e.g. Enterprise Sales Funnel"
                    className="h-14 pl-12 rounded-2xl bg-card border-border/40 font-bold text-base focus:ring-4 focus:ring-primary/5 focus:border-primary/40 transition-all shadow-premium-sm"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                   />
                </div>
              </div>

              {/* Stages List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <Label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50">Workflow Stages</Label>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    onClick={addStage}
                    className="h-8 rounded-lg font-black text-[9px] uppercase tracking-widest text-primary hover:bg-primary/5 gap-2"
                  >
                    <Plus className="size-3" /> Add Phase
                  </Button>
                </div>

                <div className="max-h-[280px] overflow-y-auto px-1 no-scrollbar pb-2 -mx-1">
                  <Reorder.Group axis="y" values={stages} onReorder={setStages} className="space-y-2">
                    {stages.map((stage) => (
                      <Reorder.Item 
                        key={stage.id} 
                        value={stage}
                        className="flex items-center gap-3 bg-card/40 backdrop-blur-sm border border-border/20 p-3 rounded-2xl shadow-sm hover:border-primary/20 transition-all group"
                      >
                        <div className="cursor-grab active:cursor-grabbing text-muted-foreground/20 hover:text-primary transition-colors">
                          <GripVertical className="size-4" />
                        </div>
                        
                        <div 
                          className="size-5 rounded-md shadow-inner shrink-0 transition-transform group-hover:scale-110" 
                          style={{ backgroundColor: stage.color }} 
                        />

                        <Input 
                          placeholder="Stage name"
                          className="h-8 border-none bg-transparent font-bold text-sm focus-visible:ring-0 p-0 shadow-none"
                          value={stage.title}
                          onChange={(e) => updateStage(stage.id, { title: e.target.value })}
                        />

                        <div className="flex items-center gap-2 pr-1">
                           {stage.isFinal && (
                             <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 text-[8px] font-black uppercase tracking-widest border border-emerald-500/10">
                               Terminal
                             </div>
                           )}
                           <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => removeStage(stage.id)}
                            className="h-7 w-7 rounded-lg hover:bg-red-500/5 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                           >
                            <Trash2 className="size-3.5" />
                           </Button>
                        </div>
                      </Reorder.Item>
                    ))}
                  </Reorder.Group>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-6 border-t border-border/10 flex items-center justify-between gap-4">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={onClose}
                className="h-14 flex-1 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-muted/50"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isLoading}
                className="h-14 flex-[2] rounded-[24px] bg-primary text-primary-foreground font-black uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-primary/25 hover:scale-[1.02] active:scale-[0.98] transition-all gap-2"
              >
                {isLoading ? <FlashLoader /> : (
                  <>
                    <Layers className="size-4" /> Deploy Process
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
