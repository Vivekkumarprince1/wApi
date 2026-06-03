"use client";

import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  User, 
  MessageSquare, 
  CheckCircle2, 
  Clock,
  MoreVertical,
  ChevronDown,
  Inbox as InboxIcon,
  MessageCircle,
  Camera,
  Share2,
  Mail,
  Smartphone
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Conversation } from '@/lib/api/inbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ConversationsListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (conv: Conversation) => void;
  isLoading: boolean;
  activeStatus: string;
  onFilterChange: (filter: string) => void;
  activeAssignment: string;
  onAssignmentChange: (assignment: string) => void;
  activeChannel: string;
  onChannelChange: (channel: string) => void;
}

export default function ConversationsList({ 
  conversations, 
  selectedId, 
  onSelect, 
  isLoading,
  activeStatus,
  onFilterChange,
  activeAssignment,
  onAssignmentChange,
  activeChannel,
  onChannelChange
}: ConversationsListProps) {
  const [search, setSearch] = useState('');

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'messenger': return <MessageSquare className="h-3 w-3 text-blue-600" />;
      case 'instagram': return <Camera className="h-3 w-3 text-pink-600" />;
      case 'sms': return <Smartphone className="h-3 w-3 text-amber-600" />;
      case 'email': return <Mail className="h-3 w-3 text-purple-600" />;
      default: return <MessageCircle className="h-3 w-3 text-emerald-600" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'normal': return 'bg-sky-500';
      case 'low': return 'bg-slate-400';
      default: return 'bg-slate-400';
    }
  };

  return (
    <div className="flex flex-col h-full bg-card border-r border-border/50 animate-in fade-in duration-500">
      {/* Header & Tabs */}
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
            Inbox
            <Badge variant="secondary" className="rounded-full px-2 py-0 h-5 text-[10px] font-bold bg-primary/10 text-primary border-primary/10">
              {conversations.length}
            </Badge>
          </h2>
          <DropdownMenu>
            <DropdownMenuTrigger className="p-2 hover:bg-muted rounded-xl transition-colors outline-none cursor-pointer flex items-center gap-2 border border-border/50 bg-background/50">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {activeAssignment === 'me' ? 'Mine' : 
                 activeAssignment === 'unassigned' ? 'Unassigned' : 
                 activeAssignment === 'team' ? 'My Team' : 'All'}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-2xl p-2 shadow-premium border-border/50 min-w-[160px]">
               <DropdownMenuItem onClick={() => onAssignmentChange('me')} className={`rounded-xl font-bold cursor-pointer ${activeAssignment === 'me' ? 'bg-primary/10 text-primary' : ''}`}>Assigned to me</DropdownMenuItem>
               <DropdownMenuItem onClick={() => onAssignmentChange('team')} className={`rounded-xl font-bold cursor-pointer ${activeAssignment === 'team' ? 'bg-primary/10 text-primary' : ''}`}>My Team</DropdownMenuItem>
               <DropdownMenuItem onClick={() => onAssignmentChange('unassigned')} className={`rounded-xl font-bold cursor-pointer ${activeAssignment === 'unassigned' ? 'bg-primary/10 text-primary' : ''}`}>Unassigned</DropdownMenuItem>
               <DropdownMenuItem onClick={() => onAssignmentChange('all')} className={`rounded-xl font-bold cursor-pointer ${activeAssignment === 'all' ? 'bg-primary/10 text-primary' : ''}`}>All Conversations</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex bg-muted/30 p-1 rounded-2xl overflow-x-auto no-scrollbar">
          {['all', 'open', 'snoozed', 'resolved', 'spam'].map((f) => (
            <button 
              key={f}
              onClick={() => onFilterChange(f)}
              className={`
                flex-1 py-1.5 px-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap
                ${activeStatus === f ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}
              `}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Channel Filters */}
        <div className="flex gap-2 pb-1 overflow-x-auto no-scrollbar">
          {[
            { id: 'all', icon: InboxIcon, label: 'All' },
            { id: 'whatsapp', icon: MessageCircle, label: 'WA' },
            { id: 'sms', icon: Smartphone, label: 'SMS' },
            { id: 'email', icon: Mail, label: 'Mail' }
          ].map((ch) => (
            <button
              key={ch.id}
              onClick={() => onChannelChange(ch.id)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border
                ${activeChannel === ch.id 
                  ? 'bg-primary/10 border-primary/20 text-primary' 
                  : 'bg-background border-border/50 text-muted-foreground hover:border-primary/20 hover:text-foreground'}
              `}
            >
              <ch.icon className="h-3 w-3" />
              {ch.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search chats..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-10 rounded-xl bg-muted/20 border-none focus-visible:ring-primary/20"
          />
        </div>
      </div>

      {/* Conversations List */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-4 space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex gap-4 items-center">
                <div className="w-12 h-12 rounded-2xl bg-muted animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                  <div className="h-2 w-full bg-muted animate-pulse rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
             <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground opacity-30">
                <InboxIcon className="h-6 w-6" />
             </div>
             <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-10">No {activeStatus} conversations found</p>
          </div>
        ) : (
          <div className="flex flex-col px-2 pb-4">
            <AnimatePresence mode="popLayout" initial={false}>
              {conversations.map((conv) => (
                <motion.div
                  key={conv._id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => onSelect(conv)}
                  className={`
                    flex items-center gap-4 p-3 rounded-2xl transition-all cursor-pointer group relative
                    ${selectedId === conv._id ? 'bg-primary/5 ring-1 ring-primary/20 shadow-premium-sm' : 'hover:bg-muted/50'}
                  `}
                >
                  <div className="relative">
                    <Avatar className="h-12 w-12 rounded-2xl border-2 border-background shadow-sm overflow-visible">
                      <AvatarImage src={conv.contact?.avatar} className="rounded-2xl" />
                      <AvatarFallback className="bg-primary/10 text-primary font-black uppercase rounded-2xl text-xs">
                        {conv.contact?.name?.charAt(0) || '?'}
                      </AvatarFallback>
                      {/* Channel Icon Overlay */}
                      <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-background border border-border/50 flex items-center justify-center shadow-sm">
                         {getChannelIcon(conv.channel)}
                      </div>
                    </Avatar>
                    
                    {/* Priority Indicator */}
                    {conv.priority !== 'normal' && (
                      <div className={`absolute top-0 -left-1 w-2 h-2 rounded-full border-2 border-background shadow-sm ${getPriorityColor(conv.priority)}`} />
                    )}
  
                    {(conv.myUnreadCount > 0 || conv.unreadCount > 0) && (
                      <div className={`absolute -top-1 -right-1 h-5 w-5 ${conv.myUnreadCount > 0 ? 'bg-primary' : 'bg-muted-foreground/40'} text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-background shadow-lg ${conv.myUnreadCount > 0 ? 'animate-bounce' : ''} z-10`}>
                        {conv.myUnreadCount || conv.unreadCount}
                      </div>
                    )}
                  </div>
  
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-sm font-black truncate ${selectedId === conv._id ? 'text-primary' : 'text-foreground'}`}>
                          {(() => {
                            const isValid = (val?: string) => val && val.trim() && val.toLowerCase() !== 'unknown';
                            if (isValid(conv.contact?.name)) return conv.contact.name;
                            return conv.contact?.phone || 'Unknown Contact';
                          })()}
                        </span>
                        {conv.labels && conv.labels[0] && (
                          <Badge variant="secondary" className="text-[8px] font-black h-4 px-1.5 bg-primary/10 text-primary border-none uppercase tracking-tighter">
                            {conv.labels[0]}
                          </Badge>
                        )}
                      </div>
                      <span className="text-[9px] font-bold text-muted-foreground whitespace-nowrap">
                        {conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    <p className="text-[11px] font-medium text-muted-foreground truncate group-hover:text-foreground/80 transition-colors">
                      {conv.lastMessage?.body || 'New conversation'}
                    </p>
                    <div className="flex items-center gap-1.5 pt-1">
                       {conv.contact?.tags?.slice(0, 2).map(tag => (
                         <Badge key={tag} variant="outline" className="text-[8px] font-black h-4 px-1.5 opacity-60 uppercase tracking-tighter">
                           {tag}
                         </Badge>
                       ))}
                    </div>
                  </div>
  
                  {selectedId === conv._id && (
                    <div className="absolute right-3 bottom-3 text-primary animate-in zoom-in-50">
                      <CheckCircle2 className="h-3 w-3" />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
