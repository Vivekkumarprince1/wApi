"use client";

import React, { useState, useEffect } from 'react';
import { 
  User, 
  Phone, 
  Mail, 
  Tag, 
  Plus, 
  Clock, 
  ShoppingBag, 
  StickyNote, 
  ChevronDown, 
  ChevronUp,
  X,
  PlusCircle,
  TrendingUp,
  History,
  Box,
  ExternalLink,
  ShieldCheck,
  MoreVertical,
  Target,
  DollarSign,
  ChevronRight,
  Inbox as InboxIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fetchContactDeals, Deal, Pipeline } from '@/lib/api/crm';
import { DealDialog } from '@/components/dashboard/crm/DealDialog';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface ContactDetailsSidebarProps {
  contact: any;
  conversation: any;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onAddNote: (note: string) => void;
  onSetLabel?: (label: string | null) => void;
  onAssign?: (agentId: string) => void;
  onAssignTeam?: (teamId: string) => void;
  onUnassign?: () => void;
  notes: any[];
  agents?: any[];
  teams?: any[];
  orders?: any[];
  isUpdating?: boolean;
  pipelines?: Pipeline[];
}

const SectionHeader = ({ label, icon: Icon, section, count, isLoading, isExpanded, isUpdating, onToggle }: any) => {
  return (
    <button 
      onClick={() => onToggle(section)}
      className={`w-full flex items-center justify-between p-3.5 rounded-2xl transition-all duration-300 group
        ${isExpanded ? 'bg-primary/5 text-primary shadow-premium-sm ring-1 ring-primary/20' : 'hover:bg-muted/50 text-muted-foreground'}
      `}
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-xl transition-all duration-300 ${isExpanded ? 'bg-primary text-white scale-110' : 'bg-muted group-hover:bg-background group-hover:text-primary group-hover:scale-105 shadow-sm'} ${isUpdating || isLoading ? 'animate-pulse' : ''}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="flex flex-col items-start">
          <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${isExpanded ? 'text-primary' : ''}`}>{label}</span>
          {(isUpdating || isLoading) && <span className="text-[8px] font-bold text-primary animate-pulse uppercase tracking-tighter">Syncing...</span>}
        </div>
        {count !== undefined && !(isUpdating || isLoading) && (
          <Badge variant="secondary" className="h-4 text-[9px] font-black px-1.5 opacity-60">
            {count}
          </Badge>
        )}
      </div>
      <div className={`transition-transform duration-500 ${isExpanded ? 'rotate-180 opacity-100' : 'opacity-30 group-hover:opacity-60'}`}>
        <ChevronDown className="h-3.5 w-3.5" />
      </div>
    </button>
  );
};

export default function ContactDetailsSidebar({ 
  contact, 
  conversation, 
  onAddTag, 
  onRemoveTag, 
  onAddNote, 
  onSetLabel,
  onAssign,
  onAssignTeam,
  onUnassign,
  notes,
  agents = [],
  teams = [],
  orders = [],
  pipelines = [],
  isUpdating = false
}: ContactDetailsSidebarProps) {
  const queryClient = useQueryClient();
  const [expandedSections, setExpandedSections] = useState({
    labels: false,
    assignment: false,
    lifecycle: false,
    tags: false,
    notes: false,
    orders: false,
    timeline: false
  });
  const [newNote, setNewNote] = useState('');
  const [newTag, setNewTag] = useState('');
  const [isDealDialogOpen, setIsDealDialogOpen] = useState(false);
  const agentList = Array.isArray(agents) ? agents : [];

  const { data: dealsResponse, isLoading: isDealsLoading } = useQuery({
    queryKey: ['deals', contact?._id],
    queryFn: () => fetchContactDeals(contact._id),
    enabled: !!contact?._id
  });

  const deals: Deal[] = dealsResponse?.data || [];

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };



  const getTagColor = (tag: string) => {
    const colors = [
      'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
      'bg-blue-500/10 text-blue-600 border-blue-500/20',
      'bg-amber-500/10 text-amber-600 border-amber-500/20',
      'bg-purple-500/10 text-purple-600 border-purple-500/20',
      'bg-rose-500/10 text-rose-600 border-rose-500/20',
      'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
      'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
      'bg-teal-500/10 text-teal-600 border-teal-500/20',
    ];
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
      hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="flex flex-col h-full bg-card border-l border-border/50 animate-in slide-in-from-right-4 duration-500 overflow-hidden relative font-sans">
      {/* 1. Sticky Contact Profile Header */}
      <div className="sticky top-0 z-20 p-6 flex flex-col items-center text-center space-y-4 border-b border-border/30 bg-background/80 backdrop-blur-xl transition-all duration-300">
        <div className="flex w-full items-center justify-between absolute top-4 px-4">
           <div className="w-8 h-8 rounded-xl bg-primary/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {/* Spacer/Decoration */}
           </div>
           <DropdownMenu>
              <DropdownMenuTrigger asChild>
                 <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-muted transition-colors">
                    <MoreVertical className="h-4 w-4 text-muted-foreground" />
                 </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-2xl p-2 shadow-premium border-border/50 w-48">
                 <DropdownMenuItem className="rounded-xl font-black text-[10px] uppercase tracking-widest gap-3 cursor-pointer">
                    <Mail className="h-4 w-4" /> Send Email
                 </DropdownMenuItem>
                 <DropdownMenuItem 
                   onClick={() => setIsDealDialogOpen(true)}
                   className="rounded-xl font-black text-[10px] uppercase tracking-widest gap-3 cursor-pointer"
                 >
                    <TrendingUp className="h-4 w-4 text-emerald-500" /> Create Deal
                 </DropdownMenuItem>
                 <DropdownMenuItem className="rounded-xl font-black text-[10px] uppercase tracking-widest gap-3 cursor-pointer text-destructive">
                    <ShieldCheck className="h-4 w-4" /> Block Contact
                 </DropdownMenuItem>
              </DropdownMenuContent>
           </DropdownMenu>
        </div>

        <div className="relative group pt-2">
          <Avatar className="h-20 w-20 rounded-[28px] border-4 border-background shadow-xl hover:scale-105 transition-transform duration-500 ring-4 ring-primary/5">
            <AvatarImage src={contact.avatar || contact.avatarUrl} />
            <AvatarFallback className="bg-primary/10 text-primary text-2xl font-black rounded-[28px]">
              {contact.name?.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="absolute -bottom-1 -right-1 h-7 w-7 rounded-2xl bg-emerald-500 text-white flex items-center justify-center border-4 border-background shadow-lg">
             <ShieldCheck className="h-3.5 w-3.5" />
          </div>
        </div>
        
        <div className="space-y-1">
          <h3 className="text-lg font-black tracking-tight text-foreground leading-none">
            {(() => {
              const isValid = (val?: string) => val && val.trim() && val.toLowerCase() !== 'unknown';
              if (isValid(contact.name)) return contact.name;
              return contact.phone || 'Unknown';
            })()}
          </h3>
          <div className="flex items-center justify-center gap-2">
            <Badge variant="outline" className="h-5 rounded-lg text-[9px] font-black uppercase tracking-widest border-border/50 bg-muted/30">
              <Phone className="h-2.5 w-2.5 mr-1" /> {contact.phone}
            </Badge>
          </div>
        </div>
      </div>

      {/* 2. Scrollable Details Area */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col p-4 space-y-3">
          
          {/* Labels/Segment Section */}
          <div className="flex flex-col">
            <SectionHeader label="Segment & Labels" icon={ShieldCheck} section="labels" isUpdating={isUpdating} isExpanded={expandedSections.labels} onToggle={toggleSection} />
            <AnimatePresence>
              {expandedSections.labels && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }} 
                  animate={{ height: 'auto', opacity: 1 }} 
                  exit={{ height: 0, opacity: 0 }}
                  className="px-4 pb-4 space-y-4 pt-2"
                >
                  <div className="space-y-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Active Segment</p>
                    <div className="flex flex-wrap gap-2">
                       {['General', 'Sales', 'Support', 'Billing', 'VIP', 'Urgent'].map((label) => {
                         const isActive = conversation?.label === label;
                         const colors: Record<string, string> = {
                           'Sales': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
                           'Support': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
                           'Billing': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
                           'VIP': 'bg-purple-500/10 text-purple-600 border-purple-500/20',
                           'Urgent': 'bg-rose-500/10 text-rose-600 border-rose-500/20',
                           'General': 'bg-slate-500/10 text-slate-600 border-slate-500/20'
                         };
                         return (
                           <button
                             key={label}
                             onClick={() => onSetLabel?.(isActive ? null : label)}
                             className={`
                                px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all
                                ${isActive ? colors[label] || 'bg-primary text-white border-primary shadow-premium-sm' : 'bg-muted/30 text-muted-foreground hover:bg-muted border-transparent'}
                             `}
                           >
                              {label}
                           </button>
                         );
                       })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Lifecycle & CRM Section */}
          <div className="flex flex-col">
            <SectionHeader label="Sales Lifecycle" icon={TrendingUp} section="lifecycle" count={deals.length} isLoading={isDealsLoading} isExpanded={expandedSections.lifecycle} onToggle={toggleSection} />
            <AnimatePresence>
              {expandedSections.lifecycle && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }} 
                  animate={{ height: 'auto', opacity: 1 }} 
                  exit={{ height: 0, opacity: 0 }}
                  className="px-4 pb-4 space-y-4 pt-2"
                >
                   <div className="space-y-3">
                      {deals.length > 0 ? deals.map((deal) => (
                        <div key={deal._id} className="p-3 bg-muted/20 border border-border/40 rounded-2xl group hover:border-emerald-500/20 transition-all cursor-pointer">
                           <div className="flex items-start justify-between mb-2">
                              <h4 className="text-[11px] font-black text-foreground truncate group-hover:text-primary transition-colors">{deal.title}</h4>
                              <Badge className={`h-4 text-[8px] font-black uppercase tracking-tighter border-none px-1.5 ${
                                deal.status === 'won' ? 'bg-emerald-500 text-white' : 
                                deal.status === 'lost' ? 'bg-red-500 text-white' : 
                                'bg-blue-500 text-white'
                              }`}>
                                {deal.status}
                              </Badge>
                           </div>
                           <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground">
                                 <Target className="h-3 w-3" /> {deal.stage}
                              </div>
                              <div className="flex items-center gap-0.5 text-[11px] font-black text-foreground">
                                 <span className="text-emerald-500">{deal.currency === 'USD' ? '$' : '₹'}</span>
                                 {deal.value?.toLocaleString()}
                              </div>
                           </div>
                        </div>
                      )) : (
                        <div className="p-8 text-center bg-muted/10 rounded-[28px] border-2 border-dashed border-border/30">
                           <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50 mb-4">No active deals</p>
                           <Button 
                             className="w-full h-10 rounded-xl font-black uppercase tracking-widest text-[10px] bg-primary/10 text-primary hover:bg-primary shadow-none border border-primary/20 hover:text-white"
                             onClick={() => setIsDealDialogOpen(true)}
                           >
                              <Plus className="h-3.5 w-3.5 mr-2" /> New Deal
                           </Button>
                        </div>
                      )}
                      
                      {deals.length > 0 && (
                        <Button variant="ghost" className="w-full h-9 rounded-xl text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100 italic transition-all">
                           Manage in Pipeline <ChevronRight className="h-3 w-3 ml-1.5" />
                        </Button>
                      )}
                   </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          {/* Assignment Section */}
          <div className="flex flex-col">
            <SectionHeader label="Assignment" icon={User} section="assignment" isUpdating={isUpdating} isExpanded={expandedSections.assignment} onToggle={toggleSection} />
            <AnimatePresence>
              {expandedSections.assignment && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }} 
                  animate={{ height: 'auto', opacity: 1 }} 
                  exit={{ height: 0, opacity: 0 }}
                  className="px-4 pb-4 space-y-4 pt-2"
                >
                  <div className="space-y-3">
                    {/* Agent Assignment */}
                    <div className="space-y-1.5 cursor-pointer">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Assigned Agent</p>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="w-full justify-between h-10 rounded-xl px-3 border-border/50 bg-background/50 hover:bg-muted/50 transition-all text-left">
                            <div className="flex items-center gap-2 truncate">
                              <User className="h-3.5 w-3.5 text-primary" />
                              <span className="text-xs font-bold truncate">
                                {conversation?.assignedTo?.name || 'Unassigned'}
                              </span>
                            </div>
                            <ChevronDown className="h-3 w-3 opacity-30" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-64 rounded-2xl p-2 shadow-premium border-border/50 max-h-60 overflow-y-auto">
                           <DropdownMenuItem onClick={() => onUnassign?.()} className="rounded-xl font-bold gap-3 cursor-pointer text-destructive italic">
                             Unassign current agent
                           </DropdownMenuItem>
                           {agentList.map((agent: any) => (
                             <DropdownMenuItem 
                                key={agent._id} 
                                onClick={() => onAssign?.(agent._id)}
                                className={`rounded-xl font-bold gap-3 cursor-pointer ${conversation?.assignedTo?._id === agent._id ? 'bg-primary/10 text-primary' : ''}`}
                             >
                               <div className="flex flex-col">
                                 <span className="text-sm">{agent.name}</span>
                                 <span className="text-[9px] opacity-40 uppercase tracking-widest">{agent.role} {agent.team ? `• ${agent.team.name}` : ''}</span>
                               </div>
                             </DropdownMenuItem>
                           ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Team Assignment */}
                    <div className="space-y-1.5 cursor-pointer">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Team Pool</p>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="w-full justify-between h-10 rounded-xl px-3 border-border/50 bg-background/50 hover:bg-muted/50 transition-all text-left">
                            <div className="flex items-center gap-2 truncate">
                              <Box className="h-3.5 w-3.5 text-emerald-500" />
                              <span className="text-xs font-bold truncate">
                                {conversation?.team?.name || 'No Team pool'}
                              </span>
                            </div>
                            <ChevronDown className="h-3 w-3 opacity-30" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-64 rounded-2xl p-2 shadow-premium border-border/50">
                           {teams.map((team: any) => (
                             <DropdownMenuItem 
                                key={team._id} 
                                onClick={() => onAssignTeam?.(team._id)}
                                className={`rounded-xl font-bold gap-3 cursor-pointer ${conversation?.team?._id === team._id ? 'bg-emerald-50/50 text-emerald-600' : ''}`}
                             >
                                <div className="flex flex-col">
                                 <span className="text-sm">{team.name}</span>
                                 <span className="text-[9px] opacity-40 uppercase tracking-widest">{team.members?.length || 0} Members</span>
                               </div>
                             </DropdownMenuItem>
                           ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Tags Section */}
          <div className="flex flex-col">
            <SectionHeader label="Tags" icon={Tag} section="tags" count={contact.tags?.length} isExpanded={expandedSections.tags} onToggle={toggleSection} />
            <AnimatePresence>
              {expandedSections.tags && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }} 
                  animate={{ height: 'auto', opacity: 1 }} 
                  exit={{ height: 0, opacity: 0 }}
                  className="px-4 pb-4 space-y-4 pt-2"
                >
                  <div className="flex flex-wrap gap-2">
                    {contact.tags?.map((tag: string) => (
                      <Badge 
                        key={tag} 
                        className={`
                          ${getTagColor(tag)} 
                          group transition-all py-1.5 px-3 rounded-xl border text-[10px] font-black uppercase tracking-tighter
                          hover:shadow-sm hover:scale-[1.02] active:scale-[0.98]
                        `}
                      >
                        {tag}
                        <button 
                          onClick={() => onRemoveTag(tag)} 
                          className="ml-2 p-0.5 rounded-full hover:bg-black/5 transition-colors"
                        >
                          <X className="h-2.5 w-2.5 opacity-40 group-hover:opacity-100" />
                        </button>
                      </Badge>
                    ))}
                    {(!contact.tags || contact.tags.length === 0) && (
                      <p className="text-[10px] italic text-muted-foreground font-medium">No tags assigned</p>
                    )}
                  </div>
                  <div className="relative group/input">
                    <PlusCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40 group-focus-within/input:text-primary group-focus-within/input:opacity-100 transition-all" />
                    <Input 
                      placeholder="Add tag..." 
                      className="pl-10 h-10 rounded-xl bg-muted/20 border-border/50 focus-visible:ring-primary/20 hover:bg-muted/30 transition-all font-bold text-[11px]"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newTag.trim()) {
                           onAddTag(newTag.trim());
                           setNewTag('');
                        }
                      }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Notes Section */}
          <div className="flex flex-col">
            <SectionHeader label="System Notes" icon={StickyNote} section="notes" count={notes.length} isExpanded={expandedSections.notes} onToggle={toggleSection} />
            <AnimatePresence>
              {expandedSections.notes && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }} 
                  animate={{ height: 'auto', opacity: 1 }} 
                  exit={{ height: 0, opacity: 0 }}
                  className="px-4 pb-4 space-y-4 pt-2"
                >
                   <div className="space-y-3">
                      {notes.map((note: any) => (
                        <div key={note._id} className="p-3 bg-muted/30 rounded-2xl border border-border/50 relative group">
                           <p className="text-xs font-medium text-foreground/80 leading-relaxed mb-1">{note.text}</p>
                           <div className="flex items-center justify-between opacity-40 text-[9px] font-black uppercase tracking-widest">
                              <span>Admin</span>
                              <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                           </div>
                        </div>
                      ))}
                   </div>
                   <div className="space-y-2">
                     <Textarea 
                       placeholder="Private note..." 
                       className="min-h-[80px] rounded-xl bg-muted/20 border-border/50 font-medium"
                       value={newNote}
                       onChange={(e) => setNewNote(e.target.value)}
                     />
                     <Button 
                       onClick={() => { if(newNote.trim()) { onAddNote(newNote.trim()); setNewNote(''); } }}
                       className="w-full rounded-xl h-10 font-black uppercase tracking-widest text-[10px] bg-primary"
                     >
                        Save Note
                     </Button>
                   </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Orders Section */}
          <div className="flex flex-col">
            <SectionHeader label="Orders" icon={ShoppingBag} section="orders" count={orders.length} isExpanded={expandedSections.orders} onToggle={toggleSection} />
            <AnimatePresence>
              {expandedSections.orders && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }} 
                  animate={{ height: 'auto', opacity: 1 }} 
                  exit={{ height: 0, opacity: 0 }}
                  className="px-6 pb-6"
                >
                  {orders.length === 0 ? (
                    <div className="p-10 text-center bg-muted/10 rounded-[28px] border-2 border-dashed border-border/30">
                       <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4 opacity-30">
                          <Box className="h-6 w-6" />
                       </div>
                       <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50">Discovery Phase: No Orders</p>
                    </div>
                  ) : (
                    <div className="space-y-3 pt-2">
                       {orders.map((order: any) => (
                         <div key={order._id} className="p-4 bg-background/50 border border-border/50 rounded-2xl hover:bg-primary/5 hover:ring-1 hover:ring-primary/20 transition-all cursor-pointer group shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                               <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-black text-[10px]">#{order._id.slice(-4).toUpperCase()}</div>
                                  <span className="text-xs font-black truncate max-w-[100px]">Order ID</span>
                               </div>
                               <Badge className="bg-emerald-500/10 text-emerald-600 border-none h-5 text-[8px] font-black uppercase tracking-widest">
                                 {order.status}
                               </Badge>
                            </div>
                            <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground">
                               <div className="flex items-center gap-1.5">
                                  <Clock className="h-3 w-3 opacity-40" />
                                  <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                               </div>
                               <span className="font-black text-primary">₹{order.total}</span>
                            </div>
                         </div>
                       ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Timeline Section */}
          <div className="flex flex-col">
            <SectionHeader label="Timeline" icon={History} section="timeline" isExpanded={expandedSections.timeline} onToggle={toggleSection} />
            <AnimatePresence>
              {expandedSections.timeline && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }} 
                  animate={{ height: 'auto', opacity: 1 }} 
                  exit={{ height: 0, opacity: 0 }}
                  className="px-6 pb-6"
                >
                   <div className="space-y-6 relative ml-3 pt-4">
                      <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-primary/30 via-border/50 to-transparent -translate-x-[0.5px]" />
                      {[
                        { type: 'auth', title: 'System Handshake', detail: 'Authenticated via BSP', time: '10:30 AM', icon: ShieldCheck },
                        { type: 'msg', title: 'Inbound Message', detail: 'WhatsApp Business API', time: '11:15 AM', icon: InboxIcon },
                        { type: 'tag', title: 'Tag Application', detail: 'Sales / High-Value', time: '11:20 AM', icon: Tag },
                      ].map((item, i) => (
                        <div key={i} className="relative flex flex-col gap-1 pl-6 group/item">
                           <div className="absolute left-0 top-1.5 h-3 w-3 rounded-full bg-background border-2 border-primary -translate-x-1/2 group-hover/item:scale-125 transition-transform shadow-sm" />
                           <div className="flex items-center justify-between">
                              <p className="text-[11px] font-black text-foreground group-hover/item:text-primary transition-colors">{item.title}</p>
                              <span className="text-[9px] font-bold text-muted-foreground uppercase opacity-40">{item.time}</span>
                           </div>
                           <p className="text-[9px] font-medium text-muted-foreground tracking-tight">{item.detail}</p>
                        </div>
                      ))}
                   </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </ScrollArea>
      
      <div className="p-4 bg-muted/30 border-t border-border/30 flex items-center justify-center gap-2">
         <ExternalLink className="h-3 w-3 text-muted-foreground opacity-50" />
         <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">View in Full CRM</span>
      </div>

      <DealDialog 
        isOpen={isDealDialogOpen}
        onClose={() => setIsDealDialogOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['deals', contact?._id] });
          setIsDealDialogOpen(false);
        }}
        pipelines={pipelines}
        deal={undefined}
      />
    </div>
  );
}
