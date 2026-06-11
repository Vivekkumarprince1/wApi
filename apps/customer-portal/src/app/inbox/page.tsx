"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  MessageSquare, 
  MoreVertical, 
  Plus, 
  Search, 
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  Loader2,
  UserPlus,
  CheckCircle,
  ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import { 
  fetchConversations, 
  fetchMessages, 
  markAsRead, 
  sendMessage, 
  sendMediaMessage,
  Conversation,
  Message,
  uploadMedia,
  fetchMembers,
  fetchTeams,
  performConversationAction
} from '@/lib/api/inbox';
import { fetchPipelines } from '@/lib/api/crm';
import ContactDetailsSidebar from '@/components/dashboard/inbox/contact-details-sidebar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSocket } from '@/hooks/use-socket';
import { useAuthStore } from '@/store/auth-store';
import ConversationsList from '@/components/dashboard/inbox/conversations-list';
import MessageThread from '@/components/dashboard/inbox/message-thread';
import ChatInput from '@/components/dashboard/inbox/chat-input';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import FlashLoader from '@/components/ui/flash-loader';

export default function InboxPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { user } = useAuthStore();
  
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [assignmentFilter, setAssignmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState('all');
  const [isDetailsOpen, setIsDetailsOpen] = useState(true);

  // 1. Fetch Conversations
  const { data: convsData, isLoading: isConvsLoading } = useQuery({
    queryKey: ['conversations', statusFilter, assignmentFilter, channelFilter],
    queryFn: () => {
      let view = 'mine';
      if (['resolved', 'snoozed', 'spam'].includes(statusFilter)) {
        view = statusFilter;
      } else {
        view = assignmentFilter === 'me' ? 'mine' : assignmentFilter;
      }
      return fetchConversations({ 
        view,
        status: ['all', 'open'].includes(statusFilter) ? undefined : statusFilter,
        channel: channelFilter === 'all' ? undefined : channelFilter
      });
    }
  });

  const conversations = convsData?.data || [];

  // 1.5 Fetch Agents, Teams & Pipelines for sidebar/assignment
  const { data: agentsData } = useQuery({
    queryKey: ['agents'],
    queryFn: fetchMembers
  });

  const { data: teamsData } = useQuery({
    queryKey: ['teams'],
    queryFn: fetchTeams
  });

  const agents = agentsData?.data || [];
  const teams = teamsData?.data || [];

  const { data: pipelinesData } = useQuery({
    queryKey: ['pipelines'],
    queryFn: fetchPipelines
  });

  const pipelines = pipelinesData?.data || pipelinesData || [];

  // 2. Fetch Messages with Infinite Loading (Chunked Pagination)
  const { 
    data: messagesPages, 
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage, 
    isLoading: isMessagesLoading,
    refetch: refetchMessages
  } = useInfiniteQuery({
    queryKey: ['messages', selectedConversation?._id],
    queryFn: ({ pageParam }) => fetchMessages(selectedConversation!._id, { before: pageParam, limit: 20 }),
    getNextPageParam: (lastPage: any) => lastPage.pagination?.hasMore ? lastPage.pagination.lastTimestamp : undefined,
    enabled: !!selectedConversation?._id,
    initialPageParam: undefined as string | undefined,
    staleTime: 1000 * 60 * 5, // Keep messages "fresh" for 5 minutes
    gcTime: 1000 * 60 * 30,   // Keep in cache for 30 minutes
  });

  // Flatten messages from all pages
  const messages = React.useMemo(() => {
    if (!messagesPages) return [];
    return [...messagesPages.pages].reverse().flatMap(page => page.data || []);
  }, [messagesPages]);

  // Handle Socket Updates - Sync with React Query Cache
  const { socket, isConnected } = useSocket({
    workspaceId: user?.workspace?._id || user?.workspace,
    conversationId: selectedConversation?._id
  });

  // Diagnostic listeners — own effect so they don't get re-registered (and
  // never cleaned up) every time `isConnected`/`selectedConversation`
  // change. The previous version registered these in the same effect as
  // the inbox handlers and returned early when disconnected, leaking
  // listeners on every reconnect.
  useEffect(() => {
    if (!socket) return;
    const onConnect = () => console.log('[Inbox:Socket] Connected', socket.id);
    const onConnectError = (err: any) => console.error('[Inbox:Socket] Connection Error:', err.message);
    const onPing = (data: any) => console.log('[Inbox:Socket] Heartbeat:', data);
    socket.on('connect', onConnect);
    socket.on('connect_error', onConnectError);
    socket.on('server:ping', onPing);
    return () => {
      socket.off('connect', onConnect);
      socket.off('connect_error', onConnectError);
      socket.off('server:ping', onPing);
    };
  }, [socket]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleNewMessage = (data: any) => {
      console.log('[Inbox:Socket] New Message Received:', data);
      
      // Update cache only if it matches current selected conversation
      if (selectedConversation && String(data.conversationId) === String(selectedConversation._id)) {
        queryClient.setQueryData(['messages', selectedConversation._id], (old: any) => {
          if (!old) return old;
          const lastPageIdx = old.pages.length - 1;
          const lastPage = old.pages[lastPageIdx];
          
          // Prevent duplicates
          const exists = lastPage.data.some((m: any) => m._id === data.message._id || m.whatsappMessageId === data.message.whatsappMessageId);
          if (exists) return old;

          const updatedPages = [...old.pages];
          updatedPages[lastPageIdx] = {
            ...lastPage,
            data: [...lastPage.data, data.message]
          };
          
          return { ...old, pages: updatedPages };
        });

        markAsRead(selectedConversation._id).catch(() => {});
      }
      
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    };

    const handleStatusUpdate = (data: any) => {
      console.log('[Inbox:Socket] Status Update:', data);
      if (!selectedConversation) return;
      queryClient.setQueryData(['messages', selectedConversation._id], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            data: page.data.map((msg: any) => 
               String(msg._id) === String(data.messageId) || msg.whatsappMessageId === data.messageId 
                ? { ...msg, status: data.status, statusUpdatedAt: data.timestamp } 
                : msg
            )
          }))
        };
      });
    };

    const handleStatusBatch = (data: any) => {
      console.log('[Inbox:Socket] Status Batch Update:', data);
      if (!selectedConversation) return;
      const updates = data.updates || [];
      if (!updates.length) return;

      queryClient.setQueryData(['messages', selectedConversation._id], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            data: page.data.map((msg: any) => {
              const update = updates.find((u: any) => String(msg._id) === String(u.messageId) || msg.whatsappMessageId === u.messageId);
              return update ? { ...msg, status: update.status, statusUpdatedAt: update.timestamp } : msg;
            })
          }))
        };
      });
    };

    // Listen to CORRECT backend event names
    socket.on('inbox:message_new', handleNewMessage);
    socket.on('inbox:message_sent', handleNewMessage); // Also treat sent as new message
    socket.on('inbox:message_status', handleStatusUpdate);
    socket.on('inbox:status_batch', handleStatusBatch);

    return () => {
      socket.off('inbox:message_new', handleNewMessage);
      socket.off('inbox:message_sent', handleNewMessage);
      socket.off('inbox:message_status', handleStatusUpdate);
      socket.off('inbox:status_batch', handleStatusBatch);
    };
  }, [socket, isConnected, selectedConversation, queryClient]);

  // Handle Conversation Selection
  const handleSelectConversation = async (conv: Conversation) => {
    setSelectedConversation(conv);
    // Mark as read immediately for the local badge
    markAsRead(conv._id).catch(() => {});
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
  };

  // Mutations
  const sendMutation = useMutation({
    mutationFn: (payload: { text: string; isNote: boolean; extraData?: any }) => 
      sendMessage(selectedConversation!._id, { 
        body: payload.text, 
        isInternalNote: payload.isNote,
        ...(payload.extraData || {})
      }, { 'x-socket-id': socket?.id }),
    
    onMutate: async (payload) => {
      // Optimistic Update
      const optimisticMsg: Message = {
        _id: `opt-${Date.now()}`,
        body: payload.text,
        type: payload.extraData?.type || (payload.isNote ? 'note' : 'text'),
        direction: 'outbound',
        status: 'queued',
        createdAt: new Date().toISOString(),
        isInternalNote: payload.isNote,
        sentBy: user,
        meta: payload.extraData 
      } as any;

      queryClient.setQueryData(['messages', selectedConversation?._id], (old: any) => {
        if (!old) return old;
        const lastPageIdx = old.pages.length - 1;
        const updatedPages = [...old.pages];
        updatedPages[lastPageIdx] = {
          ...updatedPages[lastPageIdx],
          data: [...updatedPages[lastPageIdx].data, optimisticMsg]
        };
        return { ...old, pages: updatedPages };
      });

      return { optimisticMsg };
    },

    onSuccess: (data: any, variables, context) => {
      const serverMessage = data?.data || data?.messageData || data;
      if (!serverMessage || typeof serverMessage !== 'object') {
        queryClient.invalidateQueries({ queryKey: ['messages', selectedConversation?._id] });
        return;
      }

      queryClient.setQueryData(['messages', selectedConversation?._id], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            data: page.data.map((m: any) => m._id === context?.optimisticMsg._id ? serverMessage : m)
          }))
        };
      });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    
    onError: (err: any, variables, context) => {
      queryClient.setQueryData(['messages', selectedConversation?._id], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            data: page.data.filter((m: any) => m._id !== context?.optimisticMsg._id)
          }))
        };
      });
      toast.error(err.message || 'Failed to send message');
    }
  });

  const mediaMutation = useMutation({
    mutationFn: async (file: File) => {
      const upload: any = await uploadMedia(file);
      const uploadedUrl = upload?.url || upload?.data?.url;
      if (!uploadedUrl) {
        throw new Error('Media upload failed: missing URL');
      }
      return sendMediaMessage(selectedConversation!._id, { 
        mediaUrl: uploadedUrl,
        mediaType: file.type.startsWith('image/') ? 'image' : 'document',
        mimeType: file.type,
        filename: file.name
      }, { 'x-socket-id': socket?.id });
    },
    
    onMutate: async (file) => {
      const optimisticMsg: Message = {
        _id: `opt-${Date.now()}`,
        body: `[Sending ${file.name}]`,
        type: file.type.startsWith('image/') ? 'image' : 'document',
        direction: 'outbound',
        status: 'queued',
        createdAt: new Date().toISOString(),
        media: {
           url: URL.createObjectURL(file),
           filename: file.name
        }
      } as any;

      queryClient.setQueryData(['messages', selectedConversation?._id], (old: any) => {
        if (!old) return old;
        const lastPageIdx = old.pages.length - 1;
        const updatedPages = [...old.pages];
        updatedPages[lastPageIdx] = {
          ...updatedPages[lastPageIdx],
          data: [...updatedPages[lastPageIdx].data, optimisticMsg]
        };
        return { ...old, pages: updatedPages };
      });

      return { optimisticMsg };
    },

    onSuccess: (data: any, variables, context) => {
      const serverMessage = data?.data || data?.messageData || data;
      if (!serverMessage || typeof serverMessage !== 'object') {
        queryClient.invalidateQueries({ queryKey: ['messages', selectedConversation?._id] });
        return;
      }

      queryClient.setQueryData(['messages', selectedConversation?._id], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            data: page.data.map((m: any) => m._id === context?.optimisticMsg._id ? serverMessage : m)
          }))
        };
      });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },

    onError: (err: any, variables, context) => {
      queryClient.setQueryData(['messages', selectedConversation?._id], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            data: page.data.filter((m: any) => m._id !== context?.optimisticMsg._id)
          }))
        };
      });
      toast.error(err.message || 'Failed to send media');
    }
  });

  const actionMutation = useMutation({
    mutationFn: ({ action, data = {} }: { action: string; data?: any }) => 
        performConversationAction(selectedConversation!._id, action, data),
    
    onMutate: async ({ action, data }) => {
        await queryClient.cancelQueries({ queryKey: ['conversations'] });

        const previousConversations = queryClient.getQueryData(['conversations', statusFilter, assignmentFilter]);
        const previousSelected = selectedConversation;

        const applyChanges = (conv: any) => {
            const updated = { ...conv };
            if (action === 'label') updated.label = data.label;
            if (action === 'priority') updated.priority = data.priority;
            if (action === 'assign') updated.assignedTo = agents.find((a: any) => a._id === data.agentId);
            if (action === 'unassign') updated.assignedTo = undefined;
            return updated;
        };

        queryClient.setQueryData(['conversations', statusFilter, assignmentFilter], (old: any) => {
            if (!old) return old;
            return {
                ...old,
                data: old.data.map((c: any) => c._id === selectedConversation?._id ? applyChanges(c) : c)
            };
        });

        if (selectedConversation) {
            setSelectedConversation(applyChanges(selectedConversation));
        }

        return { previousConversations, previousSelected };
    },

    onSuccess: (res: any, variables) => {
        const { action } = variables;
        toast.success(`Conversation ${action}${action.endsWith('e') ? 'd' : 'ed'} successfully`);
        
        if (['resolve', 'spam', 'snooze'].includes(action)) {
            setSelectedConversation(null);
        }
    },

    onError: (err: any, variables, context: any) => {
        toast.error(err.message || 'Action failed');
        if (context?.previousConversations) {
            queryClient.setQueryData(['conversations', statusFilter, assignmentFilter], context.previousConversations);
        }
        if (context?.previousSelected) {
            setSelectedConversation(context.previousSelected);
        }
    },

    onSettled: () => {
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
    }
  });

  if (isConvsLoading) return <FlashLoader />;

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] overflow-hidden -m-8">
      {/* 1. Conversations List */}
      <div className="w-80 flex-shrink-0 flex flex-col border-r border-border/50 bg-card/50 backdrop-blur-sm">
        <ConversationsList 
          conversations={conversations} 
          selectedId={selectedConversation?._id || null} 
          onSelect={handleSelectConversation}
          isLoading={isConvsLoading}
          activeStatus={statusFilter}
          onFilterChange={setStatusFilter}
          activeAssignment={assignmentFilter}
          onAssignmentChange={setAssignmentFilter}
          activeChannel={channelFilter}
          onChannelChange={setChannelFilter}
        />
      </div>

      {/* 2. Main Chat Area */}
      <div className="flex-1 flex flex-col bg-background relative min-h-0">
        <AnimatePresence mode="wait">
          {selectedConversation ? (
            <motion.div 
              key={selectedConversation._id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col h-full"
            >
              {/* Chat Header */}
              <div className="h-16 flex-shrink-0 px-6 border-b border-border/50 flex items-center justify-between bg-card/50 backdrop-blur-sm z-10">
                <div className="flex items-center gap-4">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                       <h3 className="text-sm font-black text-foreground">{selectedConversation.contact.name}</h3>
                       {selectedConversation.priority !== 'normal' && (
                         <Badge className={`scale-75
                           text-[8px] font-black uppercase tracking-widest px-1.5 py-0 h-4 border-none
                           ${selectedConversation.priority === 'urgent' ? 'bg-red-500 text-white' : 
                             selectedConversation.priority === 'high' ? 'bg-orange-500 text-white' : 
                             'bg-slate-400 text-white'}
                         `}>
                           {selectedConversation.priority}
                         </Badge>
                       )}
                    </div>
                    <div className="flex items-center gap-1.5">
                       <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                       <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                         {selectedConversation.status === 'open' ? 'Active now' : selectedConversation.status}
                       </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                   <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setIsDetailsOpen(!isDetailsOpen)}
                    className={`rounded-xl h-10 w-10 ${isDetailsOpen ? 'bg-primary/5 text-primary' : ''}`}
                   >
                     <AlertCircle className="h-5 w-5" />
                   </Button>
                    <DropdownMenu>
                       <DropdownMenuTrigger className="h-10 w-10 flex items-center justify-center rounded-xl hover:bg-muted transition-colors cursor-pointer outline-none border border-transparent">
                         <MoreVertical className="h-5 w-5 text-muted-foreground" />
                       </DropdownMenuTrigger>
                       <DropdownMenuContent align="end" className="rounded-2xl p-2 shadow-premium border-border/50 w-56">
                         <DropdownMenuItem 
                           className="rounded-xl font-bold gap-3 cursor-pointer"
                           onClick={() => actionMutation.mutate({ action: selectedConversation.assignedTo ? 'unassign' : 'claim' })}
                         >
                           <UserPlus className="h-4 w-4" /> {selectedConversation.assignedTo ? 'Unassign Agent' : 'Assign to Me'}
                         </DropdownMenuItem>
                         <DropdownMenuItem 
                           className="rounded-xl font-bold gap-3 cursor-pointer"
                           onClick={() => actionMutation.mutate({ action: 'resolve' })}
                         >
                           <CheckCircle className="h-4 w-4 text-emerald-500" /> Mark as Resolved
                         </DropdownMenuItem>
                         <DropdownMenuItem 
                            className="rounded-xl font-bold gap-3 cursor-pointer"
                            onClick={() => {
                                const until = new Date();
                                until.setHours(until.getHours() + 2);
                                actionMutation.mutate({ action: 'snooze', data: { until } });
                            }}
                         >
                            <Clock className="h-4 w-4 text-amber-500" /> Snooze (2h)
                         </DropdownMenuItem>
                         <DropdownMenuItem 
                            className="rounded-xl font-bold gap-3 cursor-pointer text-destructive"
                            onClick={() => actionMutation.mutate({ action: 'spam' })}
                         >
                           <ShieldAlert className="h-4 w-4" /> Mark as Spam
                         </DropdownMenuItem>
                       </DropdownMenuContent>
                    </DropdownMenu>
                </div>
              </div>

              {/* Messages Thread */}
              <div className="flex-1 relative overflow-hidden">
                <MessageThread 
                  messages={messages} 
                  isLoading={isMessagesLoading} 
                  currentUser={user} 
                  hasNextPage={hasNextPage}
                  isFetchingNextPage={isFetchingNextPage}
                  onLoadMore={() => fetchNextPage()}
                  onReact={(message, emoji) => sendMutation.mutate({
                    text: emoji,
                    isNote: false,
                    extraData: {
                      type: 'reaction',
                      reaction: {
                        messageId: message.whatsappMessageId || message._id,
                        emoji
                      }
                    }
                  })}
                />
              </div>

              {/* Chat Input */}
              <ChatInput 
                onSendMessage={(text, isNote, extraData) => sendMutation.mutate({ text, isNote, extraData })}
                onSendMedia={(file) => mediaMutation.mutate(file)}
                isSending={sendMutation.isPending || mediaMutation.isPending}
                disabled={false}
                onTyping={() => socket?.emit('typing', { conversationId: selectedConversation._id, isTyping: true })}
                channel={selectedConversation.channel}
              />
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex-1 flex flex-col items-center justify-center text-center p-12 space-y-6"
            >
              <div className="w-24 h-24 rounded-[40px] bg-primary/5 flex items-center justify-center shadow-premium-sm border border-primary/10">
                 <MessageSquare className="h-12 w-12 text-primary opacity-40" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-black tracking-tight text-foreground">Select a conversation</h2>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto font-medium">Choose a chat from the sidebar to start messaging or managing your contacts.</p>
              </div>
              <Button onClick={() => { router.push('/contacts'); }} className="rounded-2xl h-12 px-8 font-black shadow-lg shadow-primary/20">
                <Plus className="h-5 w-5 mr-2" /> Start New Chat
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 3. Contact Details Sidebar */}
      <AnimatePresence>
        {selectedConversation && isDetailsOpen && (
          <motion.div 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 340, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="flex-shrink-0 h-full min-h-0 border-l border-border/50 bg-card/50 backdrop-blur-sm"
          >
            <ContactDetailsSidebar 
              contact={selectedConversation.contact}
              conversation={selectedConversation}
              agents={agents}
              teams={teams}
              onAssign={(agentId) => actionMutation.mutate({ action: 'assign', data: { agentId } })}
              onAssignTeam={(teamId) => actionMutation.mutate({ action: 'assignToTeam', data: { teamId } })}
              onUnassign={() => actionMutation.mutate({ action: 'unassign' })}
              notes={[]} // In real app, fetch from separate query or include in contact
              onAddTag={(tag) => toast.success(`Tag ${tag} added`)}
              onRemoveTag={(tag) => toast.success(`Tag ${tag} removed`)}
              onAddNote={(note) => toast.info('Note saved')}
              onSetLabel={(label) => actionMutation.mutate({ action: 'label', data: { label } })}
              pipelines={pipelines}
              isUpdating={actionMutation.isPending}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
