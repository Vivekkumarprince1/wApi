"use client";

import React, { useState } from 'react';
import { 
  X, 
  DollarSign, 
  Clock, 
  User, 
  Phone, 
  Mail, 
  Calendar,
  Send,
  Plus,
  MessageSquare,
  History,
  Info,
  ChevronRight,
  ExternalLink,
  Target,
  CheckCircle2,
  Circle,
  MoreVertical,
  Zap,
  Tag,
  ArrowUpRight,
  Sparkles,
  AlertCircle,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Deal, DealNote, DealActivity, addDealNote } from '@/lib/api/crm';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTasks, deleteTask, updateTaskStatus, Task } from '@/lib/api/crm';
import { TaskDialog } from '@/components/dashboard/crm/TaskDialog';
import { fetchMessagesByContactId } from '@/lib/api/inbox';
import { formatDistanceToNow } from 'date-fns';

interface DealDetailSidebarProps {
  deal: Deal;
  onClose: () => void;
  onUpdate?: () => void;
}

export const DealDetailSidebar: React.FC<DealDetailSidebarProps> = ({ 
  deal, 
  onClose,
  onUpdate 
}) => {
  const [noteText, setNoteText] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [activeTab, setActiveTab] = useState('activity');
  const queryClient = useQueryClient();

  // Dialog States
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | undefined>(undefined);

  // Data Fetching
  const { data: tasks = [], isLoading: isTasksLoading } = useQuery<Task[]>({
    queryKey: ['deal-tasks', deal._id],
    queryFn: () => fetchTasks({ dealId: deal._id }),
    enabled: activeTab === 'tasks'
  });

  const { data: recentMessages = [], isLoading: isMessagesLoading, isError: isMessagesError } = useQuery({
    queryKey: ['deal-recent-messages', deal.contact?._id],
    queryFn: async () => {
      const resp: any = await fetchMessagesByContactId(deal.contact?._id, { limit: 3 });
      return resp.data?.messages || resp.data || [];
    },
    enabled: !!deal.contact?._id && activeTab === 'activity',
    retry: 1
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string, status: string }) => updateTaskStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-tasks', deal._id] });
      toast.success('Action status updated');
    }
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-tasks', deal._id] });
      toast.success('Action deleted');
    }
  });

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim() || isSubmittingNote) return;

    setIsSubmittingNote(true);
    try {
      await addDealNote(deal._id, noteText);
      setNoteText('');
      toast.success('Note added');
      onUpdate?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add note');
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const getPriorityStyles = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'urgent': return 'bg-red-500/10 text-red-600 border-red-500/20';
      case 'high': return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
      case 'medium': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'low': return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
      default: return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'stage_change': return <ArrowUpRight className="size-3.5 text-indigo-500" />;
      case 'note_added': return <MessageSquare className="size-3.5 text-amber-500" />;
      case 'assigned': return <User className="size-3.5 text-blue-500" />;
      default: return <Info className="size-3.5 text-muted-foreground" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-card border-l border-border/50 shadow-2xl overflow-hidden relative">
      {/* Header Overlay Gradient */}
      <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />

      {/* Close and Actions */}
      <div className="p-4 flex items-center justify-between relative z-10">
         <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl h-10 w-10 hover:bg-background shadow-premium-sm">
            <X className="h-5 w-5" />
         </Button>
         <div className="flex items-center gap-2">
            <Button variant="outline" className="rounded-xl h-10 px-4 font-black uppercase tracking-widest text-[9px] border-border/40 hover:bg-background">
               Move Stage
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-2xl border-border/40 shadow-premium-lg">
                <DropdownMenuItem className="font-bold py-2.5 px-4 focus:bg-emerald-500/5 focus:text-emerald-600">Mark as Won</DropdownMenuItem>
                <DropdownMenuItem className="font-bold py-2.5 px-4 focus:bg-red-500/5 focus:text-red-600">Mark as Lost</DropdownMenuItem>
                <DropdownMenuItem className="font-bold py-2.5 px-4">Archive Deal</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
         </div>
      </div>

      <div className="px-8 pb-6 space-y-6 relative z-10">
        <div className="space-y-2">
           <div className="flex items-center gap-2">
               <Badge className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border shadow-none", getPriorityStyles(deal.priority))}>
                  {deal.priority} Priority
               </Badge>
               <div className={cn(
                  "flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-widest",
                  ((deal as any).probability || 0) > 70 ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                  ((deal as any).probability || 0) > 30 ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
                  "bg-red-500/10 text-red-600 border-red-500/20"
               )}>
                  <Sparkles className="size-2.5" />
                  Interest: {(deal as any).probability || 0}%
               </div>
            </div>
           <h2 className="text-3xl font-black tracking-tight text-foreground leading-tight group-hover:text-primary transition-colors">
              {deal.title}
           </h2>
        </div>

        <div className="grid grid-cols-2 gap-4">
           <div className="bg-muted/10 p-4 rounded-3xl border border-border/10 group hover:border-primary/20 transition-all">
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2">Deal Value</p>
              <div className="flex items-baseline gap-1">
                 <span className="text-2xl font-black text-foreground tracking-tighter">
                   {deal.currency === 'USD' ? '$' : '₹'}{deal.value?.toLocaleString()}
                 </span>
                 <span className="text-[10px] font-bold text-muted-foreground/40 uppercase">{deal.currency}</span>
              </div>
           </div>
           <div className="bg-muted/10 p-4 rounded-3xl border border-border/10 group hover:border-primary/20 transition-all">
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2">In Stage Since</p>
              <div className="flex items-center gap-2">
                 <Clock className="size-5 text-primary/60" />
                 <span className="text-lg font-black text-foreground tracking-tight">4 Days</span>
              </div>
           </div>
        </div>

        {/* Dynamic Step Indicator */}
        <div className="space-y-3">
           <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
              <span className="text-primary">Pipeline Progress</span>
              <span className="text-muted-foreground">Stage 3 of 6</span>
           </div>
           <div className="flex gap-1">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div 
                  key={i} 
                  className={cn(
                    "h-1.5 flex-1 rounded-full transition-all duration-500",
                    i <= 3 ? "bg-primary shadow-[0_0_8px_rgba(var(--primary),0.3)]" : "bg-muted"
                  )} 
                />
              ))}
           </div>
        </div>
      </div>

      <Tabs 
        value={activeTab} 
        onValueChange={setActiveTab} 
        className="flex-1 flex flex-col min-h-0"
      >
        <div className="px-6 border-b border-border/10 bg-muted/[0.02]">
          <TabsList className="bg-transparent h-14 gap-8 p-0 w-full justify-start overflow-x-auto no-scrollbar">
            {[
              { id: 'activity', label: 'Timeline', icon: History },
              { id: 'notes', label: 'Notes', icon: MessageSquare },
              { id: 'tasks', label: 'Tasks', icon: CheckCircle2 },
              { id: 'contact', label: 'Contact', icon: User },
            ].map(tab => (
              <TabsTrigger 
                key={tab.id}
                value={tab.id} 
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-foreground rounded-none px-0 h-14 text-[10px] font-black uppercase tracking-widest text-muted-foreground transition-all"
              >
                <tab.icon className="h-3.5 w-3.5 mr-2" /> {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="flex-1 overflow-hidden bg-muted/[0.01]">
          <ScrollArea className="h-full">
            <AnimatePresence mode="wait">
              {/* Activity Timeline */}
              <TabsContent value="activity" className="p-8 m-0 space-y-10 animate-in fade-in slide-in-from-right-4 duration-300">
                {/* Recent Activity Pulse - Mini Inbox Integration */}
                <div className="space-y-4">
                   <div className="flex items-center justify-between px-2">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Recent Chat Pulse</h3>
                      <Badge variant="outline" className="text-[8px] font-black uppercase bg-primary/5 text-primary border-primary/10">Live</Badge>
                   </div>
                   
                   {isMessagesLoading ? (
                     <div className="space-y-3 px-2">
                        {[1, 2].map(i => (
                          <div key={i} className="h-20 w-full bg-muted/10 rounded-2xl animate-pulse border border-border/10" />
                        ))}
                     </div>
                   ) : isMessagesError ? (
                     <div className="p-6 text-center bg-red-500/5 rounded-[32px] border border-red-500/10 space-y-2">
                        <AlertCircle className="size-6 text-red-500 mx-auto opacity-40" />
                        <p className="text-[9px] font-black uppercase tracking-widest text-red-500">Failed to load pulse</p>
                     </div>
                   ) : recentMessages.length > 0 ? (
                     <div className="space-y-3">
                        {recentMessages.map((msg: any, i: number) => (
                          <div key={msg._id || i} className={cn(
                            "p-4 rounded-2xl border text-xs font-medium relative overflow-hidden group/msg transition-all hover:shadow-premium-sm",
                            msg.direction === 'inbound' ? "bg-background border-border/40" : "bg-primary/5 border-primary/10"
                          )}>
                             <div className="flex justify-between items-start mb-2">
                                <span className="text-[10px] font-black uppercase tracking-widest opacity-40">
                                   {msg.direction === 'inbound' ? 'Customer' : 'Agent'}
                                </span>
                                <span className="text-[9px] font-bold opacity-20 group-hover/msg:opacity-60 transition-opacity">
                                   {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                                </span>
                             </div>
                             <p className="line-clamp-2 opacity-80 group-hover/msg:opacity-100 transition-opacity">{msg.body}</p>
                             <div className={cn("absolute left-0 top-0 w-1 h-full", msg.direction === 'inbound' ? "bg-border/20" : "bg-primary/40")} />
                          </div>
                        ))}
                     </div>
                   ) : (
                     <div className="p-10 text-center opacity-20">
                        <MessageSquare className="size-8 mx-auto mb-2" />
                        <p className="text-[9px] font-black uppercase tracking-widest">No recent conversations</p>
                     </div>
                   )}

                   {recentMessages.length > 0 && !isMessagesLoading && (
                     <Button variant="link" className="text-[9px] font-black uppercase tracking-widest text-primary p-0 h-auto gap-1">
                        Open Full Conversation <ChevronRight className="size-3" />
                     </Button>
                   )}
                </div>

                <Separator className="opacity-10" />

                <div className="relative space-y-8 before:absolute before:left-4 before:top-2 before:bottom-2 before:w-[2px] before:bg-gradient-to-b before:from-primary/30 before:via-border/40 before:to-transparent">
                  <div className="flex items-center justify-between px-2 mb-4">
                     <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">System Log</h3>
                  </div>
                  {deal.activityLog?.length ? deal.activityLog.map((activity, i) => (
                    <motion.div 
                      key={activity._id || i} 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="relative pl-12"
                    >
                      <div className="absolute left-0 top-1 h-8 w-8 rounded-[11px] bg-background border border-border/50 flex items-center justify-center shadow-premium-sm z-10 group-hover:scale-110 transition-transform">
                         {getActivityIcon(activity.type)}
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                           <p className="text-[11px] font-black text-foreground uppercase tracking-wider">{activity.type.replace('_', ' ')}</p>
                           <span className="text-[10px] font-bold text-muted-foreground/40">{formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}</span>
                        </div>
                        <p className="text-xs text-muted-foreground/80 leading-relaxed font-medium">
                           {activity.text}
                        </p>
                        <div className="flex items-center gap-2 pt-1 opacity-50">
                           <Avatar className="size-4 rounded-md">
                              <AvatarFallback className="text-[6px] font-black">{activity.author?.name?.charAt(0) || '?'}</AvatarFallback>
                           </Avatar>
                           <span className="text-[9px] font-black uppercase tracking-widest">Action by {activity.author?.name || 'Unknown'}</span>
                        </div>
                      </div>
                    </motion.div>
                  )) : (
                    <div className="text-center py-20 opacity-20 flex flex-col items-center">
                       <Zap className="size-12 mb-4" />
                       <p className="text-[10px] font-black uppercase tracking-widest">No activity recorded</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Private Notes */}
              <TabsContent value="notes" className="p-8 m-0 space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                 <form onSubmit={handleAddNote} className="space-y-4">
                    <div className="relative group/note">
                      <textarea
                        placeholder="Type a private note..."
                        className="w-full bg-muted/20 border border-border/40 rounded-[28px] p-6 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/30 transition-all min-h-[120px] shadow-sm"
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                      />
                      <MessageSquare className="absolute right-6 top-6 h-5 w-5 text-muted-foreground opacity-20 group-focus-within/note:opacity-50 transition-opacity" />
                    </div>
                    <div className="flex justify-end">
                      <Button 
                        disabled={!noteText.trim() || isSubmittingNote}
                        className="rounded-2xl h-12 px-8 font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20 gap-2"
                      >
                        {isSubmittingNote ? <Zap className="size-4 animate-spin" /> : <Plus className="size-4" />}
                        Save Note
                      </Button>
                    </div>
                 </form>

                 <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                       <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Journal Archive</h3>
                       <Badge variant="secondary" className="bg-muted text-[10px] font-black h-5 px-1.5">{deal.notes?.length || 0}</Badge>
                    </div>
                    {deal.notes?.map((note, i) => (
                      <div key={note._id || i} className="bg-card border border-border/30 p-5 rounded-[24px] shadow-premium-sm space-y-4 group/note-card">
                         <p className="text-xs font-medium text-foreground/80 leading-relaxed">{note.text}</p>
                         <div className="flex items-center justify-between pt-4 border-t border-border/10">
                            <div className="flex items-center gap-2">
                               <Avatar className="size-6 rounded-lg ring-1 ring-border/40">
                                  <AvatarImage src={note.author?.avatar} />
                                  <AvatarFallback className="text-[8px] font-black bg-muted">{note.author?.name?.charAt(0) || '?'}</AvatarFallback>
                               </Avatar>
                               <span className="text-[10px] font-black text-muted-foreground/80">{note.author?.name || 'Unknown'}</span>
                            </div>
                            <span className="text-[9px] font-bold text-muted-foreground/30 uppercase">{new Date(note.createdAt).toLocaleDateString()}</span>
                         </div>
                      </div>
                    ))}
                 </div>
              </TabsContent>

              {/* Tasks Tab */}
              <TabsContent value="tasks" className="p-8 m-0 space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                 <div className="flex items-center justify-between">
                    <div className="space-y-1">
                       <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Associated Actions</h3>
                       <p className="text-[9px] font-bold text-muted-foreground/40 uppercase">Assigned to this deal</p>
                    </div>
                    <Button 
                      onClick={() => {
                        setTaskToEdit(undefined);
                        setIsTaskDialogOpen(true);
                      }}
                      variant="ghost" 
                      size="sm" 
                      className="h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-primary bg-primary/5 hover:bg-primary/10 transition-all gap-2 border border-primary/10"
                    >
                       <Plus className="size-3.5" /> New Task
                    </Button>
                 </div>

                  <div className="space-y-4">
                    {Array.isArray(tasks) && tasks.length > 0 ? tasks.map((task, i) => (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        key={task._id || i} 
                        className={cn(
                          "group p-5 rounded-[28px] border transition-all flex flex-col gap-4 relative overflow-hidden",
                          task.status === 'Completed' 
                            ? "bg-muted/5 opacity-40 grayscale-[0.6] border-border/20 blur-[0.2px]" 
                            : "bg-background border-border/40 hover:border-primary/30 shadow-premium-sm hover:shadow-premium"
                        )}
                      >
                         <div className="flex items-start gap-4">
                            <button 
                              onClick={() => {
                                updateStatusMutation.mutate({ 
                                  id: task._id, 
                                  status: task.status === 'Completed' ? 'Pending' : 'Completed' 
                                });
                              }}
                              className={cn(
                                "mt-1 size-7 rounded-full border-2 flex items-center justify-center transition-all duration-300",
                                task.status === 'Completed' ? "bg-emerald-500 border-emerald-500" : "bg-muted/10 border-border/40 hover:border-primary/40 shadow-sm"
                              )}
                            >
                               {task.status === 'Completed' && <CheckCircle2 className="size-3.5 text-white" />}
                            </button>
                            
                            <div className="flex-1 min-w-0 space-y-3">
                               <div className="flex items-start justify-between">
                                  <div className="space-y-0.5">
                                     <div className="flex items-center gap-2 mb-1">
                                        <Badge variant="outline" className={cn(
                                          "px-2 py-0 text-[8px] font-black uppercase tracking-widest bg-muted/30 border-border/40",
                                          task.priority === 'High' && "text-red-500 bg-red-500/5 border-red-500/20"
                                        )}>
                                           {task.priority} Priority
                                        </Badge>
                                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/30">
                                          {task.dueDate ? new Date(task.dueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'No time'}
                                        </span>
                                     </div>
                                     <h4 className={cn("text-sm font-black tracking-tight", task.status === 'Completed' && "line-through")}>
                                        {task.title}
                                     </h4>
                                  </div>
                                  <div className={cn(
                                    "p-2 rounded-xl border transition-colors",
                                    task.type === 'WhatsApp' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                                    task.type === 'Call' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' :
                                    task.type === 'Email' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                                    'bg-purple-500/10 text-purple-600 border-purple-500/20'
                                  )}>
                                     {task.type === 'WhatsApp' ? <MessageSquare className="size-3.5" /> :
                                      task.type === 'Call' ? <Phone className="size-3.5" /> :
                                      task.type === 'Email' ? <Mail className="size-3.5" /> :
                                      <Users className="size-3.5" />}
                                  </div>
                               </div>

                               <div className="flex items-center gap-2 pt-1 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                                  <Button 
                                    onClick={() => {
                                      setTaskToEdit(task);
                                      setIsTaskDialogOpen(true);
                                    }}
                                    size="sm" 
                                    className="h-8 rounded-xl bg-primary text-white text-[9px] font-black uppercase tracking-widest px-4 shadow-lg shadow-primary/20"
                                  >
                                     Edit Details
                                  </Button>
                                  <Button 
                                    onClick={() => {
                                      if(confirm('Delete this task?')) deleteTaskMutation.mutate(task._id);
                                    }}
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 rounded-xl bg-red-500/5 text-red-500 hover:bg-red-500/10"
                                  >
                                     <X className="size-3" />
                                  </Button>
                               </div>
                            </div>
                         </div>
                      </motion.div>
                    )) : (
                      <div className="text-center py-20 opacity-20 flex flex-col items-center">
                         <CheckCircle2 className="size-12 mb-4" />
                         <p className="text-[10px] font-black uppercase tracking-widest">No actions scheduled yet</p>
                      </div>
                    )}
                 </div>

                 {/* Empty state hint */}
                 <div className="pt-6 text-center">
                    <p className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest">Showing all active follow-ups for this lead</p>
                 </div>
              </TabsContent>

              {/* Contact Detail Card */}
              <TabsContent value="contact" className="p-8 m-0 animate-in fade-in slide-in-from-right-4 duration-300">
                 <div className="bg-muted/10 border border-border/30 rounded-[40px] p-8 space-y-8 relative overflow-hidden group">
                    <div className="absolute -top-10 -right-10 size-40 bg-primary/5 blur-[60px] rounded-full group-hover:bg-primary/10 transition-colors duration-700" />
                    
                    <div className="flex flex-col items-center text-center space-y-5 pb-8 border-b border-border/10">
                       <div className="relative">
                          <Avatar className="h-24 w-24 rounded-[36px] ring-8 ring-background shadow-premium transition-transform duration-500 group-hover:scale-105">
                             <AvatarImage src={deal.contact?.avatar} />
                             <AvatarFallback className="text-3xl font-black bg-gradient-to-br from-primary/20 to-primary/5 text-primary">
                               {deal.contact?.name?.charAt(0) || '?'}
                             </AvatarFallback>
                          </Avatar>
                          <div className="absolute bottom-0 right-0 size-8 bg-emerald-500 border-4 border-background rounded-2xl flex items-center justify-center text-white shadow-lg">
                             <Zap className="size-4" />
                          </div>
                       </div>
                       <div className="space-y-1">
                          <h3 className="text-2xl font-black text-foreground tracking-tight">{deal.contact?.name}</h3>
                          <div className="flex items-center justify-center gap-2">
                             <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest rounded-md py-0 opacity-60">WhatsApp Lead</Badge>
                             <div className="size-1 bg-muted-foreground/30 rounded-full" />
                             <span className="text-[10px] font-bold text-muted-foreground">Joined March 2024</span>
                          </div>
                       </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                       {[
                         { icon: Phone, label: 'Phone Number', val: deal.contact?.phone },
                         { icon: Mail, label: 'Email Address', val: 'contact@partner.com' },
                         { icon: Tag, label: 'Lead Source', val: 'Incoming Chat' },
                       ].map((item, i) => (
                         <div key={i} className="flex items-center gap-4 bg-background/40 p-4 rounded-[24px] border border-border/10 shadow-sm cursor-pointer hover:bg-background hover:shadow-premium-sm transition-all group/item">
                            <div className="size-10 rounded-[14px] bg-muted/30 flex items-center justify-center text-muted-foreground group-hover/item:text-primary transition-colors">
                               <item.icon className="size-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                               <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-40 leading-none mb-1.5">{item.label}</p>
                               <p className="text-[13px] font-black text-foreground truncate">{item.val || 'Not set'}</p>
                            </div>
                            <ChevronRight className="size-4 text-muted-foreground opacity-0 group-hover/item:opacity-40 -translate-x-2 group-hover/item:translate-x-0 transition-all" />
                         </div>
                       ))}
                    </div>

                    <div className="pt-4 flex gap-3">
                       <Button className="flex-1 rounded-[20px] h-14 font-black uppercase tracking-widest text-[10px] shadow-premium-lg gap-2">
                          <Send className="h-4 w-4" /> Open Chat
                       </Button>
                       <Button variant="outline" className="size-14 rounded-2xl font-black text-[10px] border-border/50 hover:bg-background shadow-premium-sm">
                          <ExternalLink className="h-5 w-5" />
                       </Button>
                    </div>
                 </div>
              </TabsContent>
            </AnimatePresence>
          </ScrollArea>
        </div>
      </Tabs>

      <TaskDialog 
        isOpen={isTaskDialogOpen}
        onClose={() => {
          setIsTaskDialogOpen(false);
          setTaskToEdit(undefined);
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['deal-tasks', deal._id] });
        }}
        task={taskToEdit}
        dealId={deal._id}
        contactId={deal.contact?._id}
      />
    </div>
  );
};
