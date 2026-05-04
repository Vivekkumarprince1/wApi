"use client";

import React, { useState } from 'react';
import { 
  Reply, 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  MessageSquare, 
  Hash, 
  Tag as TagIcon,
  Copy,
  Layout,
  Globe,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { 
  getQuickReplies, 
  saveQuickReply, 
  deleteQuickReply,
  QuickReply 
} from '@/lib/api/settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import FlashLoader from '@/components/ui/flash-loader';

export default function QuickRepliesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedReply, setSelectedReply] = useState<Partial<QuickReply> | null>(null);

  const { data: replies = [], isLoading } = useQuery<QuickReply[]>({
    queryKey: ['quick-replies'],
    queryFn: () => getQuickReplies()
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => saveQuickReply(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quick-replies'] });
      setIsModalOpen(false);
      setSelectedReply(null);
      toast.success('Quick reply saved');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to save')
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteQuickReply(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quick-replies'] });
      toast.success('Quick reply deleted');
    }
  });

  const filteredReplies = replies.filter(r => 
    r.shortcut.toLowerCase().includes(search.toLowerCase()) || 
    r.message.toLowerCase().includes(search.toLowerCase())
  );

  const handleOpenModal = (reply?: QuickReply) => {
    setSelectedReply(reply || { shortcut: '', message: '', category: 'General' });
    setIsModalOpen(true);
  };

  if (isLoading) return <FlashLoader />;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-4">
            Shared Snippets
            <Badge variant="secondary" className="rounded-full px-3 py-1 font-bold text-[10px] uppercase tracking-widest bg-cyan-500/5 text-cyan-600 border-cyan-500/10">
               {replies.length} Loaded
            </Badge>
          </h1>
          <p className="text-muted-foreground text-sm font-medium">Standardize responses across your team using shortcut keys in the Inbox.</p>
        </div>
        <Button onClick={() => handleOpenModal()} className="rounded-2xl h-12 px-6 font-black shadow-lg shadow-primary/20 bg-primary group">
          <Plus className="h-4 w-4 mr-2 group-hover:rotate-90 transition-transform" /> Create Snippet
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
           <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
           <Input 
             placeholder="Search by shortcut or message content..." 
             value={search}
             onChange={(e) => setSearch(e.target.value)}
             className="pl-11 h-13 rounded-2xl bg-card border-border/50 shadow-sm"
           />
        </div>
        <Button variant="outline" className="rounded-2xl h-13 px-6 border-border/50 font-bold bg-card shadow-sm"><Filter className="h-4 w-4 mr-2" /> Categories</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
           {filteredReplies.length === 0 ? (
             <div className="col-span-full py-24 text-center bg-card border border-dashed border-border/50 rounded-[40px] space-y-6">
                <div className="w-20 h-20 rounded-[30px] bg-muted flex items-center justify-center mx-auto opacity-30">
                   <Reply className="h-10 w-10" />
                </div>
                <div>
                   <h3 className="text-xl font-bold text-foreground">No snippets yet</h3>
                   <p className="text-sm text-muted-foreground max-w-sm mx-auto font-medium mt-1">Create your first quick reply to speed up customer conversations.</p>
                </div>
                <Button onClick={() => handleOpenModal()} className="rounded-2xl h-12 px-8 font-black">
                   + Add New
                </Button>
             </div>
           ) : filteredReplies.map((r, i) => (
             <motion.div 
               key={r._id}
               layout
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               className="group bg-card border border-border/50 rounded-[32px] p-6 shadow-sm hover:shadow-premium transition-all flex flex-col h-full relative overflow-hidden"
             >
                <div className="flex items-start justify-between mb-6">
                   <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-cyan-500/10 text-cyan-600 flex items-center justify-center">
                         <Hash className="h-5 w-5" />
                      </div>
                      <Badge className="bg-background text-foreground border-border/50 py-1 px-2.5 rounded-lg text-xs font-black uppercase tracking-tighter">
                         /{r.shortcut}
                      </Badge>
                   </div>
                   <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                         <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-all"><MoreVertical className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-2xl p-2 shadow-premium border-border/50">
                         <DropdownMenuItem onClick={() => handleOpenModal(r)} className="rounded-xl font-bold"><Edit3 className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
                         <DropdownMenuItem className="rounded-xl font-bold"><Copy className="h-4 w-4 mr-2" /> Duplicate</DropdownMenuItem>
                         <DropdownMenuItem 
                          className="rounded-xl font-bold text-destructive focus:bg-destructive/10"
                          onClick={() => deleteMutation.mutate(r._id)}
                         >
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                         </DropdownMenuItem>
                      </DropdownMenuContent>
                   </DropdownMenu>
                </div>

                <div className="flex-1">
                   <p className="text-sm font-medium text-muted-foreground leading-relaxed line-clamp-3 italic opacity-80 group-hover:opacity-100 transition-opacity">
                      "{r.message}"
                   </p>
                </div>

                <div className="mt-8 flex items-center justify-between border-t border-border/10 pt-4">
                   <div className="flex items-center gap-2">
                      <TagIcon className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">{r.category || 'General'}</span>
                   </div>
                   <div className="text-[10px] font-bold text-muted-foreground opacity-40">Shared with team</div>
                </div>
                
                {/* Decorative Side Gradient */}
                <div className="absolute top-0 right-0 h-1 w-full bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
             </motion.div>
           ))}
        </AnimatePresence>
      </div>

      {/* Snippet Editor Modal */}
      <AnimatePresence>
         {isModalOpen && selectedReply && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12 overflow-hidden">
               <motion.div 
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 exit={{ opacity: 0 }}
                 onClick={() => setIsModalOpen(false)}
                 className="absolute inset-0 bg-slate-950/40 backdrop-blur-md"
               />
               <motion.div 
                 initial={{ opacity: 0, scale: 0.95, y: 20 }}
                 animate={{ opacity: 1, scale: 1, y: 0 }}
                 exit={{ opacity: 0, scale: 0.95, y: 20 }}
                 className="bg-card border border-border/50 w-full max-w-lg rounded-[48px] shadow-2xl relative z-10 overflow-hidden flex flex-col"
               >
                  <div className="p-10 space-y-10">
                     <div className="flex items-start justify-between">
                        <div className="h-14 w-14 rounded-2xl bg-cyan-500 text-white flex items-center justify-center shadow-lg shadow-cyan-500/20">
                           <Reply className="h-7 w-7" />
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setIsModalOpen(false)} className="rounded-full h-10 w-10 hover:bg-muted text-muted-foreground">
                           <X className="h-5 w-5" />
                        </Button>
                     </div>

                     <div className="space-y-2">
                        <h2 className="text-2xl font-black tracking-tight">{selectedReply._id ? 'Edit Snippet' : 'New Quick Reply'}</h2>
                        <p className="text-sm font-medium text-muted-foreground leading-relaxed">System will automatically expand this shortcut when typed in the chat input.</p>
                     </div>

                     <div className="space-y-6">
                        <div className="space-y-2">
                           <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Shortcut Key</label>
                           <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-black">/</span>
                              <Input 
                                value={selectedReply.shortcut} 
                                onChange={e => setSelectedReply({ ...selectedReply, shortcut: e.target.value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() })} 
                                placeholder="pricing" 
                                className="h-14 rounded-2xl bg-muted/20 border-none font-bold pl-8"
                              />
                           </div>
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Full Message Payload</label>
                           <Textarea 
                             value={selectedReply.message} 
                             onChange={e => setSelectedReply({ ...selectedReply, message: e.target.value })} 
                             placeholder="Hi there! Our monthly plan starts from $49..." 
                             className="min-h-[140px] rounded-2xl bg-muted/20 border-none font-medium p-4"
                           />
                        </div>
                     </div>

                     <div className="space-y-4">
                        <Button 
                         disabled={saveMutation.isPending || !selectedReply.shortcut || !selectedReply.message}
                         onClick={() => saveMutation.mutate(selectedReply)}
                         className="w-full h-14 rounded-2xl bg-cyan-600 text-white font-black text-sm shadow-xl shadow-cyan-600/20 transition-all hover:scale-[1.02]"
                        >
                           {saveMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Save Snippet'}
                        </Button>
                        <p className="text-center text-[10px] font-black uppercase tracking-widest opacity-30">Accessible by all workspace agents</p>
                     </div>
                  </div>
               </motion.div>
            </div>
         )}
      </AnimatePresence>
    </div>
  );
}
