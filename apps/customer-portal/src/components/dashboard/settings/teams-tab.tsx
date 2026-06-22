"use client";

import React, { useState } from 'react';
import { 
  Users, 
  Plus, 
  MoreVertical, 
  Settings2, 
  Trash2, 
  UserPlus, 
  ArrowRight,
  Shield,
  Zap
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { 
  deleteTeam,
  TeamMember 
} from '@/lib/api/settings';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TeamsTabProps {
  teams: any[];
  onEdit: (team: any) => void;
  onCreate: () => void;
}

export default function TeamsTab({ teams, onEdit, onCreate }: TeamsTabProps) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTeam(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-teams'] });
      toast.success('Team deleted');
    }
  });

  return (
    <div className="space-y-8">
       {/* Empty State / Creation */}
       {teams.length === 0 && (
         <div className="bg-card border border-dashed border-border/50 rounded-[40px] p-20 text-center space-y-6">
            <div className="h-20 w-20 rounded-[32px] bg-primary/5 text-primary flex items-center justify-center mx-auto">
               <Users className="h-10 w-10" />
            </div>
            <div className="space-y-2">
               <h3 className="text-xl font-black">Organize into Teams</h3>
               <p className="text-sm font-medium text-muted-foreground max-w-xs mx-auto">Group agents into teams like Sales, Support, or Billing to manage access and auto-assign chats.</p>
            </div>
            <Button onClick={onCreate} className="rounded-2xl h-12 px-8 font-black bg-primary">
               Create First Team
            </Button>
         </div>
       )}

       {teams.length > 0 && (
         <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {teams.map((team, i) => (
              <motion.div 
                key={team._id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="group bg-card border border-border/50 rounded-[32px] p-8 space-y-6 hover:shadow-xl hover:shadow-primary/5 transition-all relative overflow-hidden"
              >
                 <div className="flex items-start justify-between relative z-10">
                    <div className="h-14 w-14 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-lg overflow-hidden">
                       <Users className="h-7 w-7" />
                    </div>
                    <DropdownMenu>
	                       <DropdownMenuTrigger asChild>
	                          <Button variant="ghost" size="icon" aria-label={`Open actions for team ${team.name}`} className="h-10 w-10 rounded-xl hover:bg-muted/10">
	                             <MoreVertical className="h-5 w-5 text-muted-foreground group-hover:text-foreground" />
	                          </Button>
	                       </DropdownMenuTrigger>
                       <DropdownMenuContent align="end" className="rounded-2xl p-2 shadow-premium border-border/50">
                          <DropdownMenuItem onClick={() => onEdit(team)} className="rounded-xl font-bold">
                             <Settings2 className="h-4 w-4 mr-2" /> Team Settings
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="rounded-xl font-bold text-destructive"
                                          onClick={() => {
                                             if (!window.confirm(`Delete team "${team.name}"? Members will be unassigned.`)) return;
                                             deleteMutation.mutate(team._id);
                                          }}
                          >
                             <Trash2 className="h-4 w-4 mr-2" /> Delete Team
                          </DropdownMenuItem>
                       </DropdownMenuContent>
                    </DropdownMenu>
                 </div>

                 <div className="space-y-2 relative z-10">
                    <h4 className="text-xl font-black tracking-tight">{team.name}</h4>
                    <p className="text-xs font-medium text-muted-foreground line-clamp-2 h-8 leading-relaxed">
                       {team.description || "Grouping agents for specialized handling."}
                    </p>
                 </div>

                 <div className="flex items-center gap-3 relative z-10">
                    <Badge variant="secondary" className="rounded-lg px-2 py-0.5 font-bold text-[9px] uppercase tracking-widest bg-emerald-500/5 text-emerald-600 border-none">
                       {team.members?.length || 0} Members
                    </Badge>
                    {team.autoAssign?.enabled && (
                      <Badge className="rounded-lg px-2 py-0.5 font-bold text-[9px] uppercase tracking-widest bg-blue-500/5 text-blue-600 border-none flex items-center gap-1">
                         <Zap className="h-2.5 w-2.5" /> Auto-Assign
                      </Badge>
                    )}
                 </div>

                 <div className="pt-6 border-t border-border/10 flex items-center justify-between relative z-10">
                    <div className="flex -space-x-2">
                       {team.members?.slice(0, 4).map((m: any, idx: number) => (
                         <div key={idx} className="h-8 w-8 rounded-full bg-slate-100 border-2 border-card flex items-center justify-center text-[10px] font-black text-slate-500 overflow-hidden ring-1 ring-border/5">
                            {m.user?.name?.charAt(0) || <Shield className="h-3 w-3" />}
                         </div>
                       ))}
                       {team.members?.length > 4 && (
                         <div className="h-8 w-8 rounded-full bg-muted border-2 border-card flex items-center justify-center text-[8px] font-black opacity-60">
                            +{team.members.length - 4}
                         </div>
                       )}
                    </div>
                    <Button variant="ghost" className="h-9 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 transition-all group/btn" onClick={() => onEdit(team)}>
                       Configure <ArrowRight className="h-3 w-3 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                    </Button>
                 </div>

                 {/* Subtle Background Glow */}
                 <div className="absolute -bottom-10 -right-10 h-32 w-32 bg-primary/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
              </motion.div>
            ))}

            {/* Create Card */}
            <motion.button 
              onClick={onCreate}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: teams.length * 0.05 }}
              className="group bg-muted/20 border border-dashed border-border/50 rounded-[32px] p-8 flex flex-col items-center justify-center space-y-4 hover:bg-primary/5 hover:border-primary/20 transition-all cursor-pointer min-h-[280px]"
            >
               <div className="h-14 w-14 rounded-2xl bg-card border border-border/50 flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all shadow-sm">
                  <Plus className="h-6 w-6 text-muted-foreground group-hover:text-primary" />
               </div>
               <div className="text-center">
                  <p className="text-sm font-black text-foreground opacity-60 group-hover:opacity-100 uppercase tracking-widest">New Team</p>
               </div>
            </motion.button>
         </div>
       )}
    </div>
  );
}
