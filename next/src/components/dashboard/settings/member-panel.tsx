'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Mail, Users, X, UsersRound, Check } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { inviteTeamMember, updateMember, getTeams } from '@/lib/api/settings';
import { Input } from '@/components/ui/input';
import { getWorkspaceRoleOptions, roleMatches } from './role-options';
import { ShieldCheck, UserCheck, Search, Loader2, AlertCircle } from 'lucide-react';

type MemberPanelMode = 'invite' | 'edit';

type MemberPanelProps = {
  mode: MemberPanelMode;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  roles: any[];
  member?: any;
};

export default function MemberPanel({ mode, isOpen, onClose, onSuccess, roles, member }: MemberPanelProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'agent',
  });

  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [availableTeams, setAvailableTeams] = useState<any[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);

  const [searchStatus, setSearchStatus] = useState<{
    isLoading: boolean;
    exists: boolean;
    isMember: boolean;
    user?: any;
    error?: string;
  }>({ isLoading: false, exists: false, isMember: false });

  const availableRoles = useMemo(() => getWorkspaceRoleOptions(roles), [roles]);
  const isInviteMode = mode === 'invite';
  const isEditingInvite = !isInviteMode && (member?.status === 'pending' || member?.status === 'invited');

  // Search Logic (Debounced)
  useEffect(() => {
    if (!isInviteMode || form.email.length < 5 || !form.email.includes('@')) {
      setSearchStatus({ isLoading: false, exists: false, isMember: false });
      return;
    }

    const timer = setTimeout(async () => {
      setSearchStatus(prev => ({ ...prev, isLoading: true, error: undefined }));
      try {
        const response = await fetch(`/api/workspace/team/search?email=${encodeURIComponent(form.email)}`);
        const result = await response.json();
        
        if (result.success && result.data) {
          const { exists, user, isMember } = result.data;
          setSearchStatus({ isLoading: false, exists, isMember, user });
          
          if (exists && user) {
            // Auto-fetch name and phone if user exists
            setForm(prev => ({
              ...prev,
              name: user.name || prev.name,
              phone: user.phone || prev.phone
            }));
          }
        }
      } catch (err) {
        setSearchStatus(prev => ({ ...prev, isLoading: false, error: 'Failed to search user' }));
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [form.email, isInviteMode]);

  useEffect(() => {
    if (!isOpen) return;

    setForm({
      name: member?.name || '',
      email: member?.email || '',
      phone: member?.phone || '',
      role: member?.role || 'agent',
    });
    setSearchStatus({ isLoading: false, exists: false, isMember: false });

    // Fetch teams in both modes
    setTeamsLoading(true);
    getTeams()
      .then((teams: any) => {
        const teamList = Array.isArray(teams) ? teams : [];
        setAvailableTeams(teamList);

        if (!isInviteMode && member) {
          // Pre-select the teams this member currently belongs to
          const memberTeamIds = teamList
            .filter((t: any) =>
              (t.members || []).some((m: any) => {
                const uid = m.user?._id || m.user || m._id;
                const memberId = member._id || member.id;
                return uid?.toString() === memberId?.toString();
              })
            )
            .map((t: any) => t._id || t.id);
          setSelectedTeamIds(memberTeamIds);
        } else {
          setSelectedTeamIds([]);
        }
      })
      .catch(() => { setAvailableTeams([]); setSelectedTeamIds([]); })
      .finally(() => setTeamsLoading(false));
  }, [isOpen, member, mode, isInviteMode]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isInviteMode) {
        return inviteTeamMember({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          role: form.role,
          teamIds: selectedTeamIds.length > 0 ? selectedTeamIds : undefined,
        });
      }

      return updateMember(member._id || member.id, {
        name: form.name.trim(),
        phone: form.phone.trim(),
        role: form.role,
        teamIds: selectedTeamIds,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-members'] });
      toast.success(isInviteMode ? `Agent ${form.name} invited successfully` : `${form.name || member?.name || 'Agent'} updated successfully`);
      onSuccess();
    },
    onError: (err: any) => {
      const errorMsg = err.response?.data?.error || err.message || (isInviteMode ? 'Failed to invite' : 'Failed to update agent');
      toast.error(errorMsg);
    }
  });

  const resendMutation = useMutation({
    mutationFn: () => updateMember(member._id || member.id, {
      name: form.name.trim(),
      phone: form.phone.trim(),
      role: form.role,
      resendEmail: true,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-members'] });
      toast.success('Invitation email resent');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to resend invitation email'),
  });

  const saveLabel = isInviteMode ? 'Save Agent' : 'Save Changes';
  const headerLabel = isInviteMode ? 'Create Agent' : isEditingInvite ? 'Edit Invite' : 'Edit Agent';

  return (
    <AnimatePresence>
      {isOpen && (isInviteMode || member) && (
        <div className="fixed inset-0 z-[100] flex">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/30"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="ml-auto relative w-full max-w-md bg-card border-l border-border shadow-2xl h-full flex flex-col"
          >
            <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
              <h2 className="text-base font-semibold text-foreground">{headerLabel}</h2>
              <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-md transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg border border-border/50">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold bg-[#25D366]">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground">{isInviteMode ? 'New workspace agent' : member?.name || 'Workspace agent'}</div>
                  <div className="text-xs text-muted-foreground">
                    {isInviteMode ? 'Invite by email and assign the appropriate role.' : 'Update the name, phone, and role for this member.'}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Email ID (Login ID) <span className="text-red-500">*</span></label>
                <div className="relative">
                  {isInviteMode ? (
                    <>
                      <Input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                        required
                        placeholder="priya@company.com"
                        className={`w-full px-3 py-2 bg-background border rounded-lg text-sm transition-all pr-10 ${
                          searchStatus.isMember ? 'border-amber-500 focus:ring-amber-500/20' : 
                          searchStatus.exists ? 'border-emerald-500 focus:ring-emerald-500/20' : 
                          'border-border focus:ring-primary/20'
                        }`}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {searchStatus.isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : searchStatus.isMember ? (
                          <AlertCircle className="h-4 w-4 text-amber-500" />
                        ) : searchStatus.exists ? (
                          <UserCheck className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Search className="h-4 w-4 text-muted-foreground opacity-30" />
                        )}
                      </div>
                    </>
                  ) : (
                    <Input
                      type="email"
                      value={form.email}
                      readOnly
                      disabled
                      className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm text-muted-foreground cursor-not-allowed"
                    />
                  )}
                </div>
                {isInviteMode && searchStatus.exists && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`mt-1.5 p-2 rounded-lg text-[11px] flex items-center gap-2 ${
                      searchStatus.isMember ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' : 
                      'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                    }`}
                  >
                    {searchStatus.isMember ? (
                      <>
                        <AlertCircle className="h-3 w-3" />
                        <span><strong>Found:</strong> This user is already a member of this workspace.</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-3 w-3" />
                        <span><strong>Found:</strong> Global account recognized. Auto-fetching details.</span>
                      </>
                    )}
                  </motion.div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">First &amp; Last Name <span className="text-red-500">*</span></label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  required
                  readOnly={searchStatus.exists}
                  placeholder="e.g. Priya Sharma"
                  className={`w-full px-3 py-2 rounded-lg text-sm transition-all ${
                    searchStatus.exists ? 'bg-muted/30 border-border/50 text-muted-foreground cursor-not-allowed' : 'bg-background border border-border'
                  }`}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Contact Number</label>
                <Input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))}
                  readOnly={searchStatus.exists}
                  placeholder="+91 98765 43210"
                  className={`w-full px-3 py-2 rounded-lg text-sm transition-all ${
                    searchStatus.exists ? 'bg-muted/30 border-border/50 text-muted-foreground cursor-not-allowed' : 'bg-background border border-border'
                  }`}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Assign Role <span className="text-red-500">*</span></label>
                <div className="space-y-2">
                  {availableRoles.map((role) => {
                    const isSelected = roleMatches(form.role, role);
                    const description = role.description || 'Custom workspace access role';

                    return (
                      <label
                        key={role.value}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                          isSelected ? 'border-[#25D366] bg-[#25D366]/5' : 'border-border hover:border-gray-300'
                        } ${searchStatus.isMember ? 'opacity-50 grayscale pointer-events-none' : ''}`}
                      >
                        <input
                          type="radio"
                          name="role"
                          value={role.value}
                          checked={isSelected}
                          onChange={(e) => setForm(prev => ({ ...prev, role: e.target.value }))}
                          className="sr-only"
                          disabled={searchStatus.isMember}
                        />
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-[#25D366]' : 'border-gray-300'}`}>
                          {isSelected && <div className="w-2 h-2 rounded-full bg-[#25D366]" />}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-foreground">{role.label}</div>
                          <div className="text-[11px] text-muted-foreground">{description}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Team Assignment — available in both invite and edit mode */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <UsersRound className="h-3.5 w-3.5 text-muted-foreground" />
                    {isInviteMode ? 'Assign to Team' : 'Team Memberships'}
                  </label>
                  <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Optional</span>
                </div>

                {teamsLoading ? (
                  <div className="flex items-center gap-2 py-3 px-3 bg-muted/30 rounded-lg">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Loading teams...</span>
                  </div>
                ) : availableTeams.length === 0 ? (
                  <div className="py-3 px-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
                    No teams created yet. Create teams in Team Settings first.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5">
                    {availableTeams.map((team: any) => {
                      const teamId = team._id || team.id;
                      const isSelected = selectedTeamIds.includes(teamId);
                      return (
                        <button
                          key={teamId}
                          type="button"
                          onClick={() => setSelectedTeamIds(prev =>
                            isSelected ? prev.filter(id => id !== teamId) : [...prev, teamId]
                          )}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all ${
                            isSelected
                              ? 'border-[#25D366] bg-[#25D366]/5 text-foreground'
                              : 'border-border hover:border-gray-300 text-muted-foreground'
                          }`}
                        >
                          <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 ${
                            isSelected ? 'border-[#25D366] bg-[#25D366]' : 'border-gray-300'
                          }`}>
                            {isSelected && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                          </div>
                          <span className="text-xs font-medium truncate">{team.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {isInviteMode ? (
                  selectedTeamIds.length > 0 && (
                    <p className="text-[10px] text-[#25D366] font-medium">
                      ✓ Will be added to {selectedTeamIds.length} team{selectedTeamIds.length > 1 ? 's' : ''} on joining
                    </p>
                  )
                ) : (
                  <p className="text-[10px] text-muted-foreground">
                    {selectedTeamIds.length === 0
                      ? 'Not assigned to any team'
                      : `Currently in ${selectedTeamIds.length} team${selectedTeamIds.length > 1 ? 's' : ''} — changes save immediately`}
                  </p>
                )}
              </div>

              <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    {isInviteMode
                      ? searchStatus.exists 
                        ? 'User found! Sending workspace join link to their existing account.'
                        : 'New user! Invitation email will be sent with login setup link.'
                      : 'Changes apply immediately to this member or invitation.'}
                  </p>
                </div>
              </div>
            </form>

            <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3 shrink-0 bg-muted/30">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted rounded-lg transition-colors">
                Cancel
              </button>
              {isEditingInvite ? (
                <button
                  type="button"
                  onClick={() => resendMutation.mutate()}
                  disabled={resendMutation.isPending || saveMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-foreground border border-border hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
                >
                  {resendMutation.isPending ? 'Resending...' : 'Resend Email'}
                </button>
              ) : null}
              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !form.name || (isInviteMode && !form.email) || searchStatus.isMember}
                className="px-5 py-2 bg-[#25D366] hover:bg-[#20bd5a] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {saveMutation.isPending ? 'Saving...' : searchStatus.isMember ? 'Already Member' : saveLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
