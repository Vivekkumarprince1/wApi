"use client";

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Users, 
  Shield, 
  UserCheck, 
  Zap, 
  Check, 
  Info,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { createTeam, updateTeam } from '@/lib/api/settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface TeamPanelProps {
  isOpen: boolean;
  onClose: () => void;
  team?: any; // If editing
  members: any[];
}

export default function TeamPanel({ isOpen, onClose, team, members }: TeamPanelProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('team_only');
  const [autoAssign, setAutoAssign] = useState({
    enabled: false,
    strategy: 'round_robin'
  });
  const [selectedMembers, setSelectedMembers] = useState<any[]>([]);

  useEffect(() => {
    if (team) {
      setName(team.name || '');
      setDescription(team.description || '');
      setVisibility(team.visibility || 'team_only');
      setAutoAssign(team.autoAssign || { enabled: false, strategy: 'round_robin' });
      setSelectedMembers(team.members?.map((m: any) => ({
        user: m.user._id || m.user,
        role: m.role || 'member'
      })) || []);
    } else {
      setName('');
      setDescription('');
      setVisibility('team_only');
      setAutoAssign({ enabled: false, strategy: 'round_robin' });
      setSelectedMembers([]);
    }
  }, [team, isOpen]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => team ? updateTeam(team._id, data) : createTeam(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-teams'] });
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast.success(team ? 'Team updated' : 'Team created');
      onClose();
    },
    onError: (err: any) => toast.error(err.message || 'Failed to save team')
  });

  const toggleMember = (agentId: string) => {
    setSelectedMembers(prev => {
      const exists = prev.find(m => m.user === agentId);
      if (exists) return prev.filter(m => m.user !== agentId);
      return [...prev, { user: agentId, role: 'member' }];
    });
  };

  const toggleLead = (agentId: string) => {
     setSelectedMembers(prev => prev.map(m => 
        m.user === agentId ? { ...m, role: m.role === 'lead' ? 'member' : 'lead' } : m
     ));
  };

  const isFormValid = name.trim().length > 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/20 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="relative w-full max-w-xl bg-card border-l border-border/50 shadow-2xl h-full flex flex-col"
          >
             {/* Header */}
             <div className="p-8 border-b border-border/50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                   <div className="h-12 w-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
                      <Users className="h-6 w-6" />
                   </div>
                   <div>
                      <h2 className="text-xl font-black">{team ? 'Edit Team' : 'Create Team'}</h2>
                      <p className="text-xs font-medium text-muted-foreground">Manage member groups and distribution.</p>
                   </div>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-10 w-10">
                   <X className="h-5 w-5" />
                </Button>
             </div>

             {/* Content */}
             <div className="flex-1 overflow-y-auto p-8 space-y-10">
                {/* Basic Info */}
                <div className="space-y-6">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Team Name</label>
                      <Input 
                        value={name} 
                        onChange={e => setName(e.target.value)} 
                        placeholder="e.g. Sales Support" 
                        className="h-14 rounded-2xl bg-muted/20 border-none font-bold"
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Description</label>
                      <Input 
                        value={description} 
                        onChange={e => setDescription(e.target.value)} 
                        placeholder="What does this team do?" 
                        className="h-14 rounded-2xl bg-muted/20 border-none font-medium"
                      />
                   </div>
                </div>

                {/* Auto Assign */}
                <div className="bg-primary/5 rounded-[32px] p-8 space-y-6 border border-primary/10">
                   <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                         <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                            <Zap className="h-5 w-5" />
                         </div>
                         <div>
                            <p className="text-sm font-black uppercase tracking-widest text-primary">Auto-Assignment</p>
                            <p className="text-[10px] font-medium opacity-60">Automatically distribute chats to available members.</p>
                         </div>
                      </div>
                      <button 
                        onClick={() => setAutoAssign(p => ({ ...p, enabled: !p.enabled }))}
                        className={`w-12 h-6 rounded-full transition-colors relative ${autoAssign.enabled ? 'bg-primary' : 'bg-muted'}`}
                      >
                         <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${autoAssign.enabled ? 'left-7' : 'left-1'}`} />
                      </button>
                   </div>

                   {autoAssign.enabled && (
                     <div className="grid grid-cols-2 gap-3 pt-2">
                        {[
                          { id: 'round_robin', name: 'Round Robin', icon: Shield },
                          { id: 'least_busy', name: 'Least Busy', icon: UserCheck },
                          { id: 'random', name: 'Random', icon: Info }
                        ].map(s => (
                          <button
                            key={s.id}
                            onClick={() => setAutoAssign(p => ({ ...p, strategy: s.id }))}
                            className={`h-12 rounded-xl border flex items-center px-4 gap-3 transition-all ${
                              autoAssign.strategy === s.id 
                                ? 'bg-white border-primary/20 text-primary shadow-sm' 
                                : 'bg-transparent border-transparent text-muted-foreground opacity-60'
                            }`}
                          >
                             <s.icon className="h-4 w-4" />
                             <span className="text-xs font-bold">{s.name}</span>
                          </button>
                        ))}
                     </div>
                   )}
                </div>

                {/* Member Selection */}
                <div className="space-y-6">
                   <div className="flex items-center justify-between px-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Select Members ({selectedMembers.length})</label>
                      <Badge variant="outline" className="text-[8px] font-black border-none uppercase opacity-40 italic">Set Lead to mark managers</Badge>
                   </div>
                   <div className="grid grid-cols-1 gap-2">
                      {members.map(agent => {
                        const selection = selectedMembers.find(m => m.user === agent._id);
                        const isSelected = !!selection;
                        const isLead = selection?.role === 'lead';

                        return (
                          <div 
                            key={agent._id}
                            onClick={() => toggleMember(agent._id)}
                            className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${
                              isSelected ? 'bg-primary/5 border-primary/20' : 'bg-card border-border/30 hover:bg-muted/10'
                            }`}
                          >
                             <div className="flex items-center gap-3">
                                <div className={`h-8 w-8 rounded-lg flex items-center justify-center font-black text-[10px] ${
                                  isSelected ? 'bg-primary text-white shadow-lg' : 'bg-muted text-muted-foreground'
                                }`}>
                                   {isSelected ? <Check className="h-4 w-4" /> : agent.name.charAt(0)}
                                </div>
                                <div className="flex flex-col">
                                   <span className="text-xs font-bold text-foreground">{agent.name}</span>
                                   <span className="text-[10px] font-medium opacity-50">{agent.email}</span>
                                </div>
                             </div>
                             
                             {isSelected && (
                               <button 
                                 onClick={(e) => { e.stopPropagation(); toggleLead(agent._id); }}
                                 className={`h-7 px-3 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                                   isLead ? 'bg-amber-500 text-white shadow-md' : 'bg-white border border-border/50 text-muted-foreground hover:bg-amber-50/50'
                                 }`}
                               >
                                  {isLead ? 'Lead Member' : 'Set as Lead'}
                               </button>
                             )}
                          </div>
                        );
                      })}
                   </div>
                </div>
             </div>

             {/* Footer */}
             <div className="p-8 border-t border-border/50 bg-muted/10 flex items-center gap-4">
                <Button variant="ghost" onClick={onClose} className="rounded-2xl h-14 flex-1 font-black">Cancel</Button>
                <Button 
                  disabled={!isFormValid || saveMutation.isPending}
                  onClick={() => saveMutation.mutate({
                    name,
                    description,
                    visibility,
                    autoAssign,
                    members: selectedMembers
                  })}
                  className="rounded-2xl h-14 flex-[2] font-black bg-slate-900 text-white shadow-xl shadow-slate-900/20"
                >
                   {saveMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Confirm Configuration'}
                </Button>
             </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
