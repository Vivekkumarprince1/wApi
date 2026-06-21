"use client";

import React, { useState, useMemo } from 'react';
import { 
  CheckSquare, 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  User as UserIcon, 
  Clock, 
  ArrowRight, 
  AlertCircle,
  MoreVertical,
  ChevronDown,
  Target,
  CheckCircle2,
  Phone,
  MessageSquare,
  Mail,
  Users,
  Bell,
  CheckCircle,
  Circle,
  Zap,
  TrendingUp,
  ExternalLink,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, isToday, isTomorrow, isPast, isFuture, startOfDay } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup
} from "@/components/ui/dropdown-menu";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { deleteTask, fetchTasks, Task, updateTaskStatus } from '@/lib/api/crm';
import FlashLoader from '@/components/ui/flash-loader';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { TaskDialog } from '@/components/dashboard/crm/TaskDialog';

const TASK_TYPE_ICONS = {
  'Call': Phone,
  'WhatsApp': MessageSquare,
  'Meeting': Users,
  'Email': Mail,
  'Follow-up': Zap
};

const TASK_TYPE_COLORS = {
  'Call': 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  'WhatsApp': 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
  'Meeting': 'text-purple-500 bg-purple-500/10 border-purple-500/20',
  'Email': 'text-amber-500 bg-amber-500/10 border-amber-500/20',
  'Follow-up': 'text-slate-500 bg-slate-500/10 border-slate-500/20'
};

export default function CRMTasksPage() {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAssignee, setFilterAssignee] = useState<'all' | 'me'>('all');
  const { user } = useAuthStore();
  
  // Dialog States
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | undefined>(undefined);

  const { data: response, isLoading } = useQuery({
    queryKey: ['crm-tasks', filterStatus, filterPriority, searchQuery, filterAssignee],
    queryFn: () => fetchTasks({ 
      status: filterStatus === 'all' ? undefined : filterStatus, 
      priority: filterPriority === 'all' ? undefined : filterPriority,
      search: searchQuery || undefined,
      assigneeId: filterAssignee === 'me' ? user?._id : undefined
    })
  });

  const tasks: Task[] = (response as any) || [];

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      return await updateTaskStatus(id, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-tasks'] });
      toast.success('Task status updated');
    }
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-tasks'] });
      toast.success('Task deleted');
    }
  });

  // Task Grouping Logic
  const groupedTasks = useMemo(() => {
    const groups: Record<string, Task[]> = {
      'Overdue': [],
      'Today': [],
      'Tomorrow': [],
      'Upcoming': [],
      'Completed': []
    };

    tasks.forEach(task => {
      if (task.status === 'Completed') {
        groups['Completed'].push(task);
        return;
      }

      const date = task.dueDate ? new Date(task.dueDate) : null;
      if (!date) {
        groups['Upcoming'].push(task);
        return;
      }

      const today = startOfDay(new Date());
      const taskDate = startOfDay(date);

      if (isPast(taskDate) && !isToday(taskDate)) groups['Overdue'].push(task);
      else if (isToday(taskDate)) groups['Today'].push(task);
      else if (isTomorrow(taskDate)) groups['Tomorrow'].push(task);
      else groups['Upcoming'].push(task);
    });

    return groups;
  }, [tasks]);

  if (isLoading) return <FlashLoader />;

  const toggleStatus = (task: Task) => {
    const newStatus = task.status === 'Completed' ? 'Pending' : 'Completed';
    updateStatusMutation.mutate({ id: task._id, status: newStatus });
  };

  const GroupHeader = ({ title, count, color }: { title: string, count: number, color: string }) => (
    <div className="flex items-center gap-3 mb-6 px-1">
       <h3 className={cn("text-[10px] font-black uppercase tracking-[0.3em]", color)}>{title}</h3>
       <div className="h-[1px] flex-1 bg-border/40" />
       <Badge variant="outline" className="rounded-full px-3 py-0.5 text-[10px] font-black border-border/40 opacity-40">{count}</Badge>
    </div>
  );

  return (
    <div className="h-[calc(100vh-theme(spacing.20))] flex flex-col bg-muted/[0.02]">
      {/* Header Container */}
      <div className="flex flex-col gap-6 px-8 pt-6 pb-2">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-4xl font-black tracking-tight text-foreground flex items-center gap-4">
              Daily Actions
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse shadow-[0_0_12px_rgba(var(--primary),0.5)]" />
            </h1>
            <p className="text-muted-foreground text-sm font-medium opacity-60">High-priority follow-ups and agent assignments for your pipeline.</p>
          </div>
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-0.5 p-1 bg-muted/20 border border-border/10 rounded-2xl shadow-premium-sm mr-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setFilterAssignee('all')}
                  className={cn("h-9 px-4 rounded-xl font-black text-[10px] uppercase tracking-widest", filterAssignee === 'all' ? "text-primary bg-background shadow-premium-sm" : "text-muted-foreground opacity-40")}
                >
                  All Tasks
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setFilterAssignee('me')}
                  className={cn("h-9 px-4 rounded-xl font-black text-[10px] uppercase tracking-widest", filterAssignee === 'me' ? "text-primary bg-background shadow-premium-sm" : "text-muted-foreground opacity-40")}
                >
                  My Tasks
                </Button>
             </div>
              <Button 
                onClick={() => {
                  setTaskToEdit(undefined);
                  setIsTaskDialogOpen(true);
                }}
                className="rounded-2xl h-12 px-8 font-black shadow-lg shadow-primary/25 bg-primary text-primary-foreground text-[10px] uppercase tracking-[0.2em] gap-2 group"
              >
                <Plus className="size-4 group-hover:rotate-90 transition-transform duration-500" /> New Task
              </Button>
          </div>
        </div>

        {/* Action Bar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
           <div className="lg:col-span-5 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40" />
              <Input 
                placeholder="Search by title, deal or contact..." 
                className="pl-11 h-13 rounded-[24px] bg-card border-border/30 focus-visible:ring-primary/20 shadow-premium-sm font-medium"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
           </div>
           
           <div className="lg:col-span-7 flex flex-wrap items-center gap-3">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[160px] h-13 rounded-2xl bg-card border-border/30 font-black text-[10px] uppercase tracking-widest shadow-premium-sm">
                   <div className="flex items-center gap-3">
                      <div className="size-5 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                        <CheckCircle2 className="h-3 w-3" />
                      </div>
                      <SelectValue placeholder="Status" />
                   </div>
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-border/40 p-2 shadow-premium-lg">
                  <SelectItem value="all" className="rounded-xl py-2.5 font-bold text-xs">All Activity</SelectItem>
                  <SelectItem value="Pending" className="rounded-xl py-2.5 font-bold text-xs">Pending</SelectItem>
                  <SelectItem value="In Progress" className="rounded-xl py-2.5 font-bold text-xs">Processing</SelectItem>
                  <SelectItem value="Completed" className="rounded-xl py-2.5 font-bold text-xs">Finished</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger className="w-[160px] h-13 rounded-2xl bg-card border-border/30 font-black text-[10px] uppercase tracking-widest shadow-premium-sm">
                   <div className="flex items-center gap-3">
                      <div className="size-5 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center">
                        <Zap className="h-3 w-3" />
                      </div>
                      <SelectValue placeholder="Priority" />
                   </div>
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-border/40 p-2 shadow-premium-lg">
                  <SelectItem value="all" className="rounded-xl py-2.5 font-bold text-xs">Any Priority</SelectItem>
                  <SelectItem value="High" className="rounded-xl py-2.5 font-bold text-xs text-red-500">Urgent Case</SelectItem>
                  <SelectItem value="Medium" className="rounded-xl py-2.5 font-bold text-xs text-amber-500">Standard</SelectItem>
                  <SelectItem value="Low" className="rounded-xl py-2.5 font-bold text-xs text-blue-500">Background</SelectItem>
                </SelectContent>
              </Select>

              <div className="h-10 w-[1px] bg-border/20 mx-2 hidden xl:block" />

              <Button
                 variant="outline"
                 onClick={() => { setFilterStatus('all'); setFilterPriority('all'); setFilterAssignee('all'); setSearchQuery(''); }}
                 className="rounded-2xl h-13 px-6 border-border/30 font-black text-[10px] uppercase tracking-widest bg-card hover:bg-muted shadow-premium-sm gap-2">
                 <Filter className="size-4 opacity-40" /> Reset Filters
              </Button>
           </div>
        </div>
      </div>

      {/* Task List Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar no-scrollbar px-8 pb-32">
        <AnimatePresence mode="popLayout">
          {tasks.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="h-[400px] bg-muted/20 border-3 border-dashed border-border/10 rounded-[48px] flex flex-col items-center justify-center text-center p-20 space-y-8 mt-10"
            >
               <div className="size-32 rounded-[48px] bg-primary/5 flex items-center justify-center border-4 border-dashed border-primary/20 animate-pulse relative">
                  <CheckSquare className="size-12 text-primary opacity-30" />
                  <div className="absolute -top-2 -right-2 size-8 bg-background border border-border/40 rounded-2xl flex items-center justify-center shadow-lg">
                     <Plus className="size-4 text-primary" />
                  </div>
               </div>
               <div className="space-y-4 max-w-sm">
                 <h3 className="text-3xl font-black tracking-tight">Clean Slate</h3>
                 <p className="text-muted-foreground font-semibold leading-relaxed opacity-60">No pending tasks found for these criteria. Perfect time to generate some leads or plan your next move.</p>
               </div>
               <Button size="lg" onClick={() => { setTaskToEdit(undefined); setIsTaskDialogOpen(true); }} className="rounded-[24px] h-16 px-12 font-black shadow-2xl shadow-primary/30 text-primary-foreground text-[11px] uppercase tracking-widest">
                  Create Master Task
               </Button>
            </motion.div>
          ) : (
            <div className="space-y-12 mt-8">
              {Object.entries(groupedTasks).map(([group, groupTasks]) => {
                if (groupTasks.length === 0) return null;
                
                const groupColor = 
                  group === 'Overdue' ? 'text-red-500' : 
                  group === 'Today' ? 'text-primary' : 
                  group === 'Completed' ? 'text-emerald-500' : 'text-muted-foreground/60';

                return (
                  <div key={group}>
                    <GroupHeader title={group} count={groupTasks.length} color={groupColor} />
                    <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6">
                      {groupTasks.map((task) => {
                        const Icon = TASK_TYPE_ICONS[task.type as keyof typeof TASK_TYPE_ICONS] || Zap;
                        const typeStyles = TASK_TYPE_COLORS[task.type as keyof typeof TASK_TYPE_COLORS] || TASK_TYPE_COLORS['Follow-up'];
                        const isOverdue = group === 'Overdue' && task.status !== 'Completed';

                        return (
                          <motion.div
                            layout
                            key={task._id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            whileHover={{ y: -4 }}
                            className={cn(
                              "group relative bg-card border border-border/40 rounded-[32px] p-6 shadow-premium-sm transition-all hover:shadow-premium hover:border-primary/30",
                              task.status === 'Completed' && "opacity-60 grayscale-[0.5]"
                            )}
                          >
                            <div className="flex gap-4 items-start">
                               {/* Status Checkbox */}
                               <button 
                                 onClick={() => toggleStatus(task)}
                                 className={cn(
                                   "mt-1.5 size-8 rounded-full border-2 flex items-center justify-center transition-all duration-500 shrink-0",
                                   task.status === 'Completed' 
                                     ? "bg-emerald-500 border-emerald-500 scale-110 shadow-[0_0_12px_rgba(16,185,129,0.4)]" 
                                     : "bg-background border-border/40 hover:border-primary/60 scale-100"
                                 )}
                               >
                                  {task.status === 'Completed' ? (
                                    <CheckCircle className="size-4 text-white" />
                                  ) : (
                                    <div className="size-1 w-1 rounded-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                                  )}
                               </button>

                               <div className="flex-1 space-y-5">
                                  {/* Top Meta */}
                                  <div className="flex items-start justify-between">
                                     <div className="space-y-1">
                                        <div className="flex items-center gap-2 mb-1.5">
                                           <div className={cn("px-2 py-0.5 rounded-lg border text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5", typeStyles)}>
                                              <Icon className="h-2.5 w-2.5" />
                                              {task.type}
                                           </div>
                                           {task.priority === 'High' && (
                                              <Badge className="bg-red-500 text-white rounded-lg text-[8px] font-black uppercase px-2 py-0.5 border-none">Urgent</Badge>
                                           )}
                                           {/* Intelligence Badge for Auto-generated tasks */}
                                           {(task.title.toLowerCase().includes('follow-up') || (task as any).isAuto) && (
                                              <div className="flex items-center gap-1.5 bg-amber-500/10 text-amber-600 border border-amber-500/20 px-2 py-0.5 rounded-lg">
                                                 <Sparkles className="size-2.5 fill-amber-500/20" />
                                                 <span className="text-[8px] font-black uppercase tracking-widest">Intelligence</span>
                                              </div>
                                           )}
                                        </div>
                                        <h4 className={cn(
                                          "text-lg font-black tracking-tight leading-tight transition-all flex items-center gap-2",
                                          task.status === 'Completed' && "line-through opacity-60"
                                        )}>
                                          {task.title}
                                        </h4>
                                     </div>
                                     <DropdownMenu>
                                       <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
                                             <MoreVertical className="size-4" />
                                          </Button>
                                       </DropdownMenuTrigger>
                                       <DropdownMenuContent className="rounded-2xl p-2 w-48 shadow-premium-lg border-border/40">
                                          <DropdownMenuGroup>
                                             <DropdownMenuItem 
                                                onClick={() => {
                                                  setTaskToEdit(task);
                                                  setIsTaskDialogOpen(true);
                                                }}
                                                className="rounded-xl font-bold gap-2 cursor-pointer"
                                             >
                                                <Plus className="size-4" /> Edit Details
                                             </DropdownMenuItem>
                                              <DropdownMenuItem 
                                                onClick={() => {
                                                   setTaskToEdit(task);
                                                   setIsTaskDialogOpen(true);
                                                }}
                                                className="rounded-xl font-bold gap-2 cursor-pointer"
                                              >
                                                <Bell className="size-4" /> Set Reminder
                                              </DropdownMenuItem>
                                          </DropdownMenuGroup>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuGroup>
                                             <DropdownMenuItem 
                                                onClick={() => {
                                                  if(confirm('Are you sure you want to delete this task?')) {
                                                    deleteTaskMutation.mutate(task._id);
                                                  }
                                                }}
                                                className="rounded-xl font-bold text-destructive gap-2 cursor-pointer"
                                             >
                                                <Calendar className="size-4" /> Delete Task
                                             </DropdownMenuItem>
                                          </DropdownMenuGroup>
                                       </DropdownMenuContent>
                                     </DropdownMenu>
                                  </div>

                                  <p className="text-sm text-muted-foreground font-medium line-clamp-2 opacity-80 leading-relaxed">
                                     {task.description || 'Proactive follow-up required to move the deal to the next stage.'}
                                  </p>

                                  {/* Footer Context */}
                                  <div className="flex items-center justify-between pt-4 border-t border-border/10">
                                     <div className="flex items-center gap-4 flex-1">
                                        {task.contact && (
                                           <div className="flex items-center gap-2 group/contact cursor-pointer">
                                              <Avatar className="size-7 rounded-lg ring-2 ring-background shadow-premium-sm transition-transform group-hover/contact:scale-110">
                                                 <AvatarImage src={task.contact.avatar} />
                                                 <AvatarFallback className="text-[10px] font-black bg-primary/5 text-primary">
                                                    {task.contact.name?.charAt(0)}
                                                 </AvatarFallback>
                                              </Avatar>
                                              <span className="text-[10px] font-black text-foreground/70">{task.contact.name}</span>
                                           </div>
                                        )}
                                        {task.deal && (
                                           <Badge variant="secondary" className="bg-muted/30 text-muted-foreground hover:text-foreground text-[9px] font-bold uppercase py-1 px-3 rounded-xl gap-2 cursor-pointer transition-colors">
                                              <Target className="size-3" />
                                              Deal Ready
                                           </Badge>
                                        )}
                                        {task.assignee && (
                                           <div className="flex items-center gap-2 group/assignee cursor-pointer ml-auto">
                                              <span className="text-[8px] font-black uppercase tracking-tighter text-muted-foreground opacity-40">Owner</span>
                                              <Avatar className="size-7 rounded-lg ring-2 ring-background shadow-premium-sm transition-transform group-hover/assignee:scale-110">
                                                 <AvatarImage src={task.assignee.avatar} />
                                                 <AvatarFallback className="text-[10px] font-black bg-emerald-500/5 text-emerald-600">
                                                    {task.assignee.name?.charAt(0)}
                                                 </AvatarFallback>
                                              </Avatar>
                                           </div>
                                         )}
                                         {task.reminders && task.reminders.length > 0 && (
                                           <div className="flex items-center justify-center size-8 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20 animate-pulse">
                                              <Bell className="size-3.5" />
                                           </div>
                                         )}
                                      </div>
                                      
                                      <div className="flex items-center gap-2 pl-4">
                                         {task.type === 'WhatsApp' && task.contact && (
                                            <Button
                                              size="icon"
                                              onClick={() => {
                                                const phone = String(task.contact?.phone || '').replace(/\D/g, '');
                                                if (phone) window.open(`https://wa.me/${phone}`, '_blank');
                                                else toast.error('No phone number on this contact');
                                              }}
                                              className="size-9 rounded-xl shadow-lg shadow-emerald-500/20 bg-emerald-500 text-white hover:bg-emerald-600 border-none"
                                            >
                                               <MessageSquare className="size-4" />
                                            </Button>
                                         )}
                                         {task.type === 'Call' && (
                                            <Button
                                              size="icon"
                                              onClick={() => {
                                                const phone = task.contact?.phone;
                                                if (phone) window.open(`tel:${phone}`);
                                                else toast.error('No phone number on this contact');
                                              }}
                                              className="size-9 rounded-xl shadow-lg shadow-blue-500/20 bg-blue-500 text-white hover:bg-blue-600 border-none"
                                            >
                                               <Phone className="size-4" />
                                            </Button>
                                         )}
                                         <Button variant="outline" size="icon" onClick={() => { setTaskToEdit(task); setIsTaskDialogOpen(true); }} className="size-9 rounded-xl border-border/40 hover:bg-muted group/ext">
                                            <ChevronRight className="size-4 transition-transform group-hover/ext:translate-x-0.5" />
                                         </Button>
                                      </div>
                                  </div>
                               </div>
                            </div>

                            {/* Overdue Badge Floating */}
                            {isOverdue && (
                               <div className="absolute -top-3 left-10 bg-red-500 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-lg shadow-red-500/20 animate-bounce">
                                  CRITICAL OVERDUE
                               </div>
                            )}

                            {/* Due Date Indicator */}
                            <div className={cn(
                              "absolute top-6 right-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-20",
                              isOverdue && "opacity-100 text-red-500"
                            )}>
                               <Clock className="size-3" />
                               {task.dueDate ? format(new Date(task.dueDate), 'HH:mm') : '--:--'}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </AnimatePresence>
      </div>

      <TaskDialog 
        isOpen={isTaskDialogOpen}
        onClose={() => {
          setIsTaskDialogOpen(false);
          setTaskToEdit(undefined);
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['crm-tasks'] });
        }}
        task={taskToEdit}
      />
    </div>
  );
}
