"use client";

import React, { useState } from 'react';
import { 
  MoreVertical, 
   Shield,
  Trash2, 
  Clock, 
  Search,
  Filter,
  Users,
   Zap,
   Edit2
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { 
  updateMemberRole, 
  deleteMember,
} from '@/lib/api/settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getWorkspaceRoleOptions } from './role-options';

interface MembersTabProps {
  members: any[];
  invitations: any[];
  roles: any[];
   onEditMember: (member: any) => void;
}

export default function MembersTab({ members, invitations, roles, onEditMember }: MembersTabProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

   const safeMembers = Array.isArray(members) ? members : [];
   const safeInvitations = Array.isArray(invitations) ? invitations : [];
   const safeRoles = getWorkspaceRoleOptions(Array.isArray(roles) ? roles : []);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteMember(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
         queryClient.invalidateQueries({ queryKey: ['workspace-members'] });
      toast.success('Member removed');
    }
  });

  const roleMutation = useMutation({
    mutationFn: (payload: { id: string, role: string }) => updateMemberRole(payload.id, payload.role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
         queryClient.invalidateQueries({ queryKey: ['workspace-members'] });
      toast.success('Role updated');
    }
  });

  // Combine Active Members and Pending Invitations
  const allMembers = [
      ...safeMembers.map(m => ({ ...m, status: 'active' })),
      ...safeInvitations.map(i => ({ ...i, status: 'pending', isOnline: false, openConversations: 0 }))
  ];

  const filteredMembers = allMembers.filter(m => 
    (m.name?.toLowerCase() || '').includes(search.toLowerCase()) || 
    (m.email?.toLowerCase() || '').includes(search.toLowerCase())
  );


  return (
    <div className="space-y-6">
       {/* Toolbar */}
       <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
             <Input 
               placeholder="Search members by name or email..." 
               value={search}
               onChange={(e) => setSearch(e.target.value)}
               className="pl-11 h-13 rounded-2xl bg-card border-border/50 shadow-sm"
             />
          </div>
          <Button variant="outline" onClick={() => setSearch('')} className="rounded-2xl h-13 px-6 border-border/50 font-bold bg-card shadow-sm"><Filter className="h-4 w-4 mr-2" /> Clear</Button>
       </div>

       <div className="bg-card border border-border/50 rounded-[40px] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
             <table className="w-full text-left">
                <thead className="bg-muted/30 border-b border-border/50">
                   <tr>
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Member</th>
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Role</th>
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Status</th>
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60 text-center">Open Chats</th>
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60 text-right">Actions</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-border/10">
                    {filteredMembers.map((m, i) => (
                      <motion.tr 
                        key={m._id || m.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="group hover:bg-muted/20 transition-colors"
                      >
                         <td className="px-8 py-5">
                            <div className="flex items-center gap-4">
                               <div className="relative">
                                  <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black uppercase">
                                     {m.name?.charAt(0) || m.email?.charAt(0) || '?'}
                                  </div>
                                  <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-card ${
                                     m.isOnline ? 'bg-emerald-500' : 'bg-slate-300'
                                  }`} />
                               </div>
                               <div className="flex flex-col">
                                  <span className="text-sm font-black text-foreground">{m.name || 'Invited Member'}</span>
                                  <span className="text-[10px] font-bold text-muted-foreground">{m.email}</span>
                               </div>
                            </div>
                         </td>
                         <td className="px-8 py-5">
                            <DropdownMenu>
                               <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" className="h-8 px-2 rounded-lg text-xs font-black uppercase tracking-tighter hover:bg-primary/5 hover:text-primary transition-all flex items-center gap-2">
                                     <Shield className="h-3 w-3" /> {m.role}
                                  </Button>
                               </DropdownMenuTrigger>
                               <DropdownMenuContent className="rounded-2xl p-2 shadow-premium border-border/50 max-h-[300px] overflow-y-auto">
                                                   {safeRoles.map(r => (
                                    <DropdownMenuItem key={r.value} onClick={() => roleMutation.mutate({ id: m._id || m.id, role: r.value })} className="rounded-xl font-bold capitalize">
                                       {r.label}
                                    </DropdownMenuItem>
                                  ))}
                               </DropdownMenuContent>
                            </DropdownMenu>
                         </td>
                         <td className="px-8 py-5">
                            <div className="flex items-center gap-2">
                               {m.status === 'pending' || m.status === 'invited' ? (
                                 <Badge className="bg-amber-500/10 text-amber-600 border-none text-[8px] font-black uppercase flex items-center gap-1">
                                    <Clock className="h-2 w-2" /> Pending
                                 </Badge>
                               ) : m.isOnline ? (
                                 <Badge className="bg-emerald-500/10 text-emerald-600 border-none text-[8px] font-black uppercase flex items-center gap-1">
                                    <div className="h-1 w-1 rounded-full bg-emerald-500" /> Active
                                 </Badge>
                               ) : (
                                 <Badge className="bg-slate-500/10 text-slate-500 border-none text-[8px] font-black uppercase flex items-center gap-1">
                                    <div className="h-1 w-1 rounded-full bg-slate-400" /> Offline
                                 </Badge>
                               )}
                            </div>
                         </td>
                         <td className="px-8 py-5 text-center">
                            <span className="text-xs font-black opacity-60">{m.openConversations || 0}</span>
                         </td>
                         <td className="px-8 py-5 text-right">
                            <DropdownMenu>
                               <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground">
                                     <MoreVertical className="h-4 w-4" />
                                  </Button>
                               </DropdownMenuTrigger>
                               <DropdownMenuContent align="end" className="rounded-2xl p-2 shadow-premium border-border/50">
                                                   <DropdownMenuItem
                                                      className="rounded-xl font-bold"
                                                      onClick={() => onEditMember(m)}
                                                   >
                                                       <Edit2 className="h-4 w-4 mr-2" /> {m.status === 'active' ? 'Edit Member' : 'Edit Invite'}
                                                   </DropdownMenuItem>
                                                   {m.status === 'pending' || m.status === 'invited' ? (
                                                      <DropdownMenuItem 
                                                         className="rounded-xl font-bold"
                                                         onClick={() => {
                                                            const baseUrl = window.location.origin;
                                                            const url = `${baseUrl}/auth/accept-invite?token=${m.token}&email=${encodeURIComponent(m.email)}`;
                                                            navigator.clipboard.writeText(url);
                                                            toast.success('Invitation link copied');
                                                         }}
                                                      >
                                                          <Zap className="h-4 w-4 mr-2" /> Copy Invite Link
                                                      </DropdownMenuItem>
                                                   ) : null}
                                                   <DropdownMenuItem
                                                      className="rounded-xl font-bold text-destructive"
                                                      onClick={() => {
                                                         const isActiveMember = m.status === 'active';
                                                         const confirmMessage = isActiveMember
                                                            ? `Remove ${m.name || 'this member'} from this workspace? They will lose all access.`
                                                            : `Revoke the invite for ${m.email || 'this member'}?`;

                                                         if (!window.confirm(confirmMessage)) return;
                                                         deleteMutation.mutate(m._id || m.id);
                                                      }}
                                                   >
                                                       <Trash2 className="h-4 w-4 mr-2" /> {m.status === 'active' ? 'Eject Member' : 'Revoke Invite'}
                                  </DropdownMenuItem>
                               </DropdownMenuContent>
                            </DropdownMenu>
                         </td>
                      </motion.tr>
                    ))}

                </tbody>
             </table>
          </div>
       </div>
    </div>
  );
}
