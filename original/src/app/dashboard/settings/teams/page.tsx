"use client";

import React, { useState } from 'react';
import { 
  Users, 
  UserPlus, 
  Plus, 
  LayoutGrid,
  ShieldCheck,
   Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { 
  getTeamMembers, 
  getTeams,
  getRoles
} from '@/lib/api/settings';
import { Button } from '@/components/ui/button';
import FlashLoader from '@/components/ui/flash-loader';

// Sub-components
import MembersTab from '@/components/dashboard/settings/members-tab';
import TeamsTab from '@/components/dashboard/settings/teams-tab';
import PermissionsTab from '@/components/dashboard/settings/permissions-tab';
import RoleBuilderTab from '@/components/dashboard/settings/role-builder-tab';
import TeamPanel from '@/components/dashboard/settings/team-panel';
import InvitePanel from '@/components/dashboard/settings/invite-panel';
import EditMemberPanel from '@/components/dashboard/settings/edit-member-panel';

export default function TeamManagementHub() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'members' | 'teams' | 'permissions' | 'roles'>('members');
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isTeamPanelOpen, setIsTeamPanelOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<any>(null);
  const [editingMember, setEditingMember] = useState<any>(null);

  // Data Queries
  const { data: teamData = { members: [], invitations: [] }, isLoading: isLoadingAgents } = useQuery({
    queryKey: ['team-members'],
    queryFn: () => getTeamMembers()
  });

  const members = teamData.members || [];
  const invitations = teamData.invitations || [];

  const { data: teams = [], isLoading: isLoadingTeams } = useQuery({
    queryKey: ['workspace-teams'],
    queryFn: () => getTeams()
  });

  const { data: rolesData } = useQuery({
    queryKey: ['workspace-roles'],
    queryFn: () => getRoles()
  });

  const roles = rolesData?.data || [];

  const isLoading = isLoadingAgents || isLoadingTeams;

  if (isLoading) return <FlashLoader />;

  const tabs = [
    { id: 'members', label: 'Members', icon: Users, count: members.length + invitations.length },
    { id: 'teams', label: 'Teams', icon: LayoutGrid, count: teams.length },
    { id: 'permissions', label: 'Matrix', icon: ShieldCheck },
    { id: 'roles', label: 'Roles', icon: Shield, count: roles.length }
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
             <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Users className="h-6 w-6" />
             </div>
             <h1 className="text-3xl font-black tracking-tight text-foreground">Team Management</h1>
          </div>
          <p className="text-muted-foreground text-sm font-medium">Coordinate your workforce and group members into specialized teams.</p>
        </div>
        <div className="flex items-center gap-3">
           <Button 
            variant="outline" 
            onClick={() => {
                setEditingTeam(null);
                setIsTeamPanelOpen(true);
            }} 
            className="rounded-2xl h-12 px-6 font-bold border-border/50 bg-card shadow-sm hover:bg-muted/10 transition-all"
           >
             <Plus className="h-4 w-4 mr-2" /> Create Team
           </Button>
            <Button onClick={() => setIsInviteOpen(true)} className="rounded-2xl h-12 px-6 font-black shadow-lg shadow-primary/20 bg-primary group">
             <UserPlus className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" /> Invite Member
           </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-muted/20 border border-border/10 rounded-[28px] w-fit">
         {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`relative flex items-center gap-2.5 px-6 py-3 rounded-[22px] text-xs font-black uppercase tracking-widest transition-all ${
                  isActive ? 'text-white' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                 {isActive && (
                   <motion.div 
                     layoutId="activeTab"
                     className="absolute inset-0 bg-slate-900 rounded-[22px] shadow-lg"
                     transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                   />
                 )}
                 <tab.icon className={`h-4 w-4 relative z-10 ${isActive ? 'text-primary' : ''}`} />
                 <span className="relative z-10">{tab.label}</span>
                 {tab.count !== undefined && (
                   <span className={`relative z-10 h-5 px-1.5 rounded-lg flex items-center justify-center text-[9px] ${
                     isActive ? 'bg-white/10 text-white' : 'bg-muted text-muted-foreground'
                   }`}>
                      {tab.count}
                   </span>
                 )}
              </button>
            );
         })}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
         <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
               {activeTab === 'members' && (
                 <MembersTab 
                   members={members} 
                   invitations={invitations} 
                            roles={roles}
                            onEditMember={setEditingMember}
                 />
               )}
               {activeTab === 'teams' && (
                 <TeamsTab 
                    teams={teams} 
                    onCreate={() => {
                        setEditingTeam(null);
                        setIsTeamPanelOpen(true);
                    }}
                    onEdit={(team) => {
                        setEditingTeam(team);
                        setIsTeamPanelOpen(true);
                    }}
                 />
               )}
               {activeTab === 'permissions' && <PermissionsTab />}
               {activeTab === 'roles' && <RoleBuilderTab />}
            </motion.div>
         </AnimatePresence>
      </div>

      {/* Side Panels */}
      <TeamPanel 
        isOpen={isTeamPanelOpen} 
        onClose={() => setIsTeamPanelOpen(false)} 
        team={editingTeam}
        members={members}
      />

      <InvitePanel
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        onSuccess={() => {
          setIsInviteOpen(false);
          queryClient.invalidateQueries({ queryKey: ['team-members'] });
        }}
        roles={roles}
      />

      <EditMemberPanel
        isOpen={!!editingMember}
        member={editingMember}
        onClose={() => setEditingMember(null)}
        onSuccess={() => {
          setEditingMember(null);
          queryClient.invalidateQueries({ queryKey: ['team-members'] });
        }}
        roles={roles}
      />
    </div>
  );
}

