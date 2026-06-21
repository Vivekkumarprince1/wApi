import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Trash2, 
  Plus, 
  ChevronRight, 
  Bell, 
  MessageSquare, 
  UserPlus, 
  ArrowRightLeft,
  Settings2,
  Sparkles,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { deletePipelineAutomationRule, fetchPipelineAutomation, savePipelineAutomationRule } from '@/lib/api/crm';
import { toast } from 'sonner';

interface AutomationRule {
  id: string;
  trigger: string;
  action: string;
  isActive: boolean;
  config?: {
    stageId?: string;
    pipelineId?: string;
    actionConfig?: any;
  };
}

const TRIGGER_OPTIONS = [
  { id: 'stage_entry', label: 'Enters Stage', icon: ChevronRight },
];

const ACTION_OPTIONS = [
  { id: 'send_template', label: 'Send WhatsApp Template', icon: MessageSquare, color: 'text-emerald-500 bg-emerald-500/10' },
  { id: 'create_task', label: 'Create Follow-up Task', icon: Bell, color: 'text-blue-500 bg-blue-500/10' },
  { id: 'assign_agent', label: 'Auto-Assign Agent', icon: UserPlus, color: 'text-purple-500 bg-purple-500/10' },
];

export const PipelineAutomation: React.FC<{ pipelineId: string; stages: any[] }> = ({ pipelineId, stages }) => {
  const queryClient = useQueryClient();

  const { data: rules = [], isLoading } = useQuery<AutomationRule[]>({
    queryKey: ['crm-automation', pipelineId],
    queryFn: async () => {
      return fetchPipelineAutomation(pipelineId);
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (rule: Partial<AutomationRule>) => {
      return savePipelineAutomationRule(pipelineId, rule);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-automation'] });
      toast.success("Automation rule updated");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return deletePipelineAutomationRule(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-automation'] });
      toast.success("Rule removed");
    }
  });

  const addRule = () => {
    saveMutation.mutate({
      trigger: 'stage_entry',
      action: 'create_task',
      isActive: true,
      config: { stageId: stages[0]?.id || '' }
    });
  };

  if (isLoading) {
    return (
      <Card className="border-none ring-1 ring-border/30 bg-card rounded-[40px] shadow-premium-lg h-60 flex items-center justify-center">
        <Loader2 className="size-6 animate-spin opacity-20" />
      </Card>
    );
  }

  return (
    <Card className="border-none ring-1 ring-border/30 bg-card rounded-[40px] shadow-premium-lg overflow-hidden">
      <CardHeader className="p-8 pb-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-2xl font-black tracking-tight flex items-center gap-3">
              Workflow Automation
              <Sparkles className="size-5 text-amber-500 fill-amber-500/20" />
            </CardTitle>
            <CardDescription className="text-xs font-semibold opacity-50 uppercase tracking-widest">
              Set triggers to auto-manage your leads and reduce manual work.
            </CardDescription>
          </div>
          <Button 
            onClick={addRule}
            disabled={saveMutation.isPending}
            className="rounded-2xl h-11 px-6 font-black bg-primary text-primary-foreground text-[10px] uppercase tracking-widest gap-2 shadow-lg shadow-primary/20"
          >
            {saveMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} New Rule
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-8 pt-2">
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {rules.map((rule, index) => (
              <motion.div
                key={rule.id}
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                transition={{ delay: index * 0.05 }}
                className="group relative flex flex-wrap items-center gap-4 p-5 rounded-[28px] bg-muted/20 border border-border/10 hover:border-primary/20 transition-all"
              >
                <div className="flex items-center gap-3 flex-1 min-w-[300px]">
                  <div className="size-10 rounded-2xl bg-background flex items-center justify-center border border-border/20 shadow-premium-sm">
                    <Zap className="size-5 text-primary opacity-60" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-40">When deal enters</span>
                    <Select 
                      defaultValue={rule.config?.stageId}
                      onValueChange={(val) => saveMutation.mutate({ ...rule, config: { ...rule.config, stageId: val } })}
                    >
                      <SelectTrigger className="h-9 w-[160px] rounded-xl font-black text-xs border-border/20 bg-background/50 hover:bg-background transition-colors px-3">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-border/40 p-2 shadow-premium-lg">
                        {stages.map(s => (
                          <SelectItem key={s.id} value={s.id} className="rounded-xl font-bold py-2.5">
                            {s.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center justify-center">
                  <div className="size-8 rounded-full bg-muted/40 border border-border/10 flex items-center justify-center">
                    <ChevronRight className="size-4 opacity-20" />
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-1 min-w-[250px]">
                  <div className="size-10 rounded-2xl bg-background flex items-center justify-center border border-border/20 shadow-premium-sm">
                    <Settings2 className="size-5 text-primary opacity-60" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-40">Automatically</span>
                    <Select 
                      defaultValue={rule.action}
                      onValueChange={(val) => saveMutation.mutate({ ...rule, action: val })}
                    >
                      <SelectTrigger className="h-9 w-[180px] rounded-xl font-black text-xs border-border/20 bg-background/50 hover:bg-background transition-colors px-3">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-border/40 p-2 shadow-premium-lg">
                        {ACTION_OPTIONS.map(opt => (
                          <SelectItem key={opt.id} value={opt.id} className="rounded-xl font-bold py-2.5">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => saveMutation.mutate({ ...rule, isActive: !rule.isActive })}
                    className={cn(
                      "px-3 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center gap-2 transition-all",
                      rule.isActive ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20" : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    <div className={cn("size-1.5 rounded-full", rule.isActive ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground")} />
                    {rule.isActive ? 'Active' : 'Paused'}
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => deleteMutation.mutate(rule.id)}
                    className="size-9 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {rules.length === 0 && !isLoading && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 border-2 border-dashed border-border/10 rounded-[40px]">
              <div className="size-16 rounded-[24px] bg-muted/40 flex items-center justify-center text-muted-foreground opacity-20">
                <Settings2 className="size-8" />
              </div>
              <p className="text-xs font-black uppercase tracking-widest opacity-20">No automation rules defined yet.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
