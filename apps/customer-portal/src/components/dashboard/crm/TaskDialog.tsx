"use client";

import React, { useState, useEffect } from 'react';
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
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  CheckCircle2, 
  Clock, 
  Type, 
  MessageSquare, 
  Phone, 
  Mail, 
  Users, 
  Zap,
  Calendar as CalendarIcon,
  AlignLeft,
  Target,
  Bell
} from 'lucide-react';
import { createTask, updateTask, Task } from '@/lib/api/crm';
import { fetchMembers } from '@/lib/api/inbox';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import FlashLoader from '@/components/ui/flash-loader';

interface TaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  task?: Task; // If provided, we are editing
  dealId?: string; // Optional context for new tasks
  contactId?: string; // Optional context for new tasks
}

const TASK_TYPES = [
  { label: 'WhatsApp Follow-up', value: 'WhatsApp', icon: MessageSquare, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
  { label: 'Outbound Call', value: 'Call', icon: Phone, color: 'text-blue-500 bg-blue-500/10 border-blue-500/20' },
  { label: 'Strategic Meeting', value: 'Meeting', icon: Users, color: 'text-purple-500 bg-purple-500/10 border-purple-500/20' },
  { label: 'Email Outreach', value: 'Email', icon: Mail, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
  { label: 'Standard Follow-up', value: 'Follow-up', icon: Zap, color: 'text-slate-500 bg-slate-500/10 border-slate-500/20' },
];

export const TaskDialog: React.FC<TaskDialogProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  task,
  dealId,
  contactId
}) => {
  const isEditing = !!task;
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'WhatsApp',
    priority: 'Medium',
    dueDate: '',
    deal: dealId || '',
    contact: contactId || '',
    assigneeId: '',
    reminder: false,
    reminderTime: ''
  });

  const { data: membersData } = useQuery({
    queryKey: ['members'],
    queryFn: fetchMembers
  });
  const members = membersData?.data?.members || (Array.isArray(membersData?.data) ? membersData?.data : []);

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title,
        description: task.description || '',
        type: task.type,
        priority: task.priority,
        dueDate: task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : '',
        deal: typeof task.deal === 'string' ? task.deal : task.deal?._id || '',
        contact: typeof task.contact === 'string' ? task.contact : task.contact?._id || '',
        assigneeId: typeof task.assignee === 'string' ? task.assignee : task.assignee?._id || '',
        reminder: !!(task.reminders && task.reminders.length > 0),
        reminderTime: !!(task.reminders && task.reminders.length > 0) 
          ? new Date(task.reminders[0].timestamp).toISOString().slice(0, 16) 
          : ''
      });
    } else {
      setFormData({
        title: '',
        description: '',
        type: 'WhatsApp',
        priority: 'Medium',
        dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 16), // Tomorrow
        deal: dealId || '',
        contact: contactId || '',
        assigneeId: '',
        reminder: false,
        reminderTime: ''
      });
    }
  }, [task, isOpen, dealId, contactId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.type) {
      toast.error("Please fill in required fields");
      return;
    }

    setIsLoading(true);
    try {
      if (isEditing) {
        await updateTask(task._id, {
          ...formData,
          reminders: formData.reminder ? [{ timestamp: formData.reminderTime }] : []
        });
        toast.success("Task updated successfully");
      } else {
        await createTask({
          ...formData,
          reminders: formData.reminder ? [{ timestamp: formData.reminderTime }] : []
        });
        toast.success("Action created successfully");
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save task");
    } finally {
      setIsLoading(false);
    }
  };

  const selectedType = TASK_TYPES.find(t => t.value === formData.type);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:max-w-[500px] p-0 overflow-hidden rounded-[32px] sm:rounded-[40px] border-none shadow-2xl">
        <form onSubmit={handleSubmit} className="flex flex-col max-h-[90vh]">
          <div className="bg-gradient-to-br from-primary/5 via-background to-background p-5 sm:p-8 flex flex-col min-h-0">
            <DialogHeader>
              <DialogTitle className="text-3xl font-black tracking-tight text-foreground">
                {isEditing ? 'Adjust Action' : 'Schedule Action'}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground font-medium">
                {isEditing ? 'Modify your follow-up sequence parameters.' : 'Establish the next checkpoint for this deal progression.'}
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-8 py-4 custom-scrollbar">
              {/* Type Selection Grid */}
              <div className="space-y-3">
                 <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 px-1">Action Category</Label>
                 <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {TASK_TYPES.map(type => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, type: type.value })}
                        className={cn(
                          "flex flex-col items-center justify-center p-3 rounded-2xl border transition-all gap-2 group",
                          formData.type === type.value 
                            ? "bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-105" 
                            : "bg-muted/10 border-border/10 hover:border-primary/20 hover:bg-muted/20"
                        )}
                      >
                         <type.icon className={cn("size-4", formData.type !== type.value && "text-muted-foreground opacity-60")} />
                         <span className="text-[7px] font-black uppercase tracking-tighter text-center">{type.value}</span>
                      </button>
                    ))}
                 </div>
              </div>

              {/* Title Input */}
              <div className="space-y-3">
                <Label htmlFor="title" className="text-[10px] font-black uppercase tracking-widest opacity-60 px-1">Action Summary</Label>
                <div className="relative group">
                   <Target className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground opacity-40 group-focus-within:text-primary transition-colors" />
                   <Input 
                    id="title"
                    placeholder="e.g. Discuss final pricing tiers"
                    className="h-12 pl-11 rounded-2xl bg-card border-border/40 font-bold focus:ring-4 focus:ring-primary/5 focus:border-primary/40 transition-all"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                   />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 {/* Assignee Selection */}
                 <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 px-1">Assign to Member</Label>
                    <Select 
                      value={formData.assigneeId} 
                      onValueChange={(v) => setFormData({ ...formData, assigneeId: v })}
                    >
                      <SelectTrigger className="h-12 rounded-2xl bg-card border-border/40 font-bold">
                        <SelectValue placeholder="Select Member" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-border/40 p-2 shadow-premium-lg">
                        {members.map((member: any) => (
                          <SelectItem key={member._id} value={member._id} className="rounded-xl font-bold py-2.5">
                            <div className="flex items-center gap-2">
                               <Avatar className="size-6">
                                  <AvatarImage src={member.avatar} />
                                  <AvatarFallback className="text-[8px] font-black">{member.name?.charAt(0)}</AvatarFallback>
                               </Avatar>
                               {member.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                 </div>

                 {/* Reminders */}
                 <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 px-1">Reminder Setting</Label>
                    <div className="flex gap-2">
                       <Button 
                         type="button"
                         variant={formData.reminder ? 'default' : 'outline'}
                         onClick={() => setFormData({ ...formData, reminder: !formData.reminder })}
                         className={cn(
                           "h-12 w-12 rounded-xl border-border/40 shrink-0",
                           formData.reminder ? "bg-primary text-white" : "bg-card"
                         )}
                       >
                          <Bell className="size-4" />
                       </Button>
                       {formData.reminder ? (
                         <Input 
                           type="datetime-local"
                           className="h-12 rounded-xl bg-card border-border/40 font-bold text-xs"
                           value={formData.reminderTime}
                           onChange={(e) => setFormData({ ...formData, reminderTime: e.target.value })}
                         />
                       ) : (
                         <div className="h-12 flex-1 flex items-center px-4 rounded-xl bg-muted/10 border border-dashed border-border/40 text-[10px] font-black uppercase tracking-widest opacity-40">
                            Inactive
                         </div>
                       )}
                    </div>
                 </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 {/* Due Date */}
                 <div className="space-y-3">
                    <Label htmlFor="dueDate" className="text-[10px] font-black uppercase tracking-widest opacity-60 px-1">Deadline Time</Label>
                    <div className="relative group">
                       <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground opacity-40 group-focus-within:text-primary transition-colors" />
                       <Input 
                        id="dueDate"
                        type="datetime-local"
                        className="h-12 pl-11 rounded-2xl bg-card border-border/40 font-bold"
                        value={formData.dueDate}
                        onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                       />
                    </div>
                 </div>

                 {/* Priority */}
                 <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 px-1">Scale of Urgency</Label>
                    <Select 
                      value={formData.priority} 
                      onValueChange={(v) => setFormData({ ...formData, priority: v })}
                    >
                      <SelectTrigger className="h-12 rounded-2xl bg-card border-border/40 font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-border/40 p-2 shadow-premium-lg">
                        <SelectItem value="Low" className="rounded-xl font-bold py-2.5">Low Intensity</SelectItem>
                        <SelectItem value="Medium" className="rounded-xl font-bold py-2.5 text-blue-500">Normal Cadence</SelectItem>
                        <SelectItem value="High" className="rounded-xl font-bold py-2.5 text-red-500">Critical Priority</SelectItem>
                      </SelectContent>
                    </Select>
                 </div>
              </div>

              {/* Description */}
              <div className="space-y-3">
                <Label htmlFor="description" className="text-[10px] font-black uppercase tracking-widest opacity-60 px-1">Specific Context (Optional)</Label>
                <div className="relative group">
                   <AlignLeft className="absolute left-4 top-4 size-4 text-muted-foreground opacity-40 group-focus-within:text-primary transition-colors" />
                   <textarea 
                    id="description"
                    placeholder="Provide specific details or meeting links..."
                    className="w-full min-h-[100px] pl-11 pr-4 py-3 rounded-2xl bg-card border-border/40 font-bold text-sm focus:ring-4 focus:ring-primary/5 focus:border-primary/40 transition-all outline-none"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                   />
                </div>
              </div>
            </div>

            <DialogFooter className="pt-6 border-t border-border/10 flex items-center justify-between gap-4 mt-auto">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={onClose}
                className="h-14 flex-1 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-muted/50"
              >
                Retreat
              </Button>
              <Button 
                type="submit" 
                disabled={isLoading}
                className="h-14 flex-[2] rounded-[24px] bg-primary text-primary-foreground font-black uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-primary/25 gap-2"
              >
                {isLoading ? <FlashLoader /> : isEditing ? 'Confirm Update' : 'Initialize Action'}
              </Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
