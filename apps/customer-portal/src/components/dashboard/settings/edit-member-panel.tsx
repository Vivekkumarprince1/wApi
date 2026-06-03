'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Mail, Users, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { updateMember } from '@/lib/api/settings';
import { Input } from '@/components/ui/input';
import MemberPanel from './member-panel';

type EditMemberPanelProps = {
  member: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  roles: any[];
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: 'Full access to settings, team, and billing',
  manager: 'Manages team, templates, and campaigns',
  agent: 'Handles conversations and contacts',
  member: 'Basic workspace access',
  viewer: 'Read-only access to analytics',
};

function normalizeRole(role: any) {
  return {
    slug: role?.slug || role?.name?.toLowerCase?.() || role?.name || '',
    label: role?.name || role?.label || role?.slug || 'Role',
    description: role?.description || '',
  };
}

export default function EditMemberPanel({ member, isOpen, onClose, onSuccess, roles }: EditMemberPanelProps) {
  return <MemberPanel mode="edit" isOpen={isOpen} member={member} onClose={onClose} onSuccess={onSuccess} roles={roles} />;

  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    phone: '',
    role: 'agent',
  });

  const availableRoles = useMemo(() => {
    const normalized = (Array.isArray(roles) ? roles : [])
      .map(normalizeRole)
      .filter(role => role.slug && role.slug !== 'owner');

    const systemOrder = ['admin', 'manager', 'agent', 'member', 'viewer'];
    const orderedSystem = systemOrder
      .map(slug => normalized.find(role => role.slug === slug))
      .filter(Boolean) as Array<ReturnType<typeof normalizeRole>>;
    const customRoles = normalized.filter(role => !systemOrder.includes(role.slug));

    return [...orderedSystem, ...customRoles];
  }, [roles]);

  useEffect(() => {
    if (!member) return;
    setForm({
      name: member.name || '',
      phone: member.phone || '',
      role: member.role || 'agent',
    });
  }, [member]);

  const updateMutation = useMutation({
    mutationFn: () => updateMember(member._id || member.id, {
      name: form.name.trim(),
      phone: form.phone.trim(),
      role: form.role,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-members'] });
      toast.success(`${form.name || member?.name || 'Agent'} updated successfully`);
      onSuccess();
    },
    onError: (err: any) => toast.error(err.message || 'Failed to update agent')
  });

  const isInvite = member?.status === 'pending' || member?.status === 'invited';

  return (
    <AnimatePresence>
      {isOpen && member && (
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
              <h2 className="text-base font-semibold text-foreground">{isInvite ? 'Edit Invite' : 'Edit Agent'}</h2>
              <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-md transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg border border-border/50">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold bg-[#25D366]">
                  {member?.name?.[0]?.toUpperCase?.() || 'U'}
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground">{member?.name || 'Unnamed'}</div>
                  <div className="text-xs text-muted-foreground">{member?.email}</div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Name</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Phone</label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+91 98765 43210"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Role</label>
                <div className="space-y-2">
                  {availableRoles.map((role) => {
                    const isSelected = form.role === role.slug;
                    const description = ROLE_DESCRIPTIONS[role.slug] || role.description || 'Custom workspace access role';

                    return (
                      <label
                        key={role.slug}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                          isSelected ? 'border-[#25D366] bg-[#25D366]/5' : 'border-border hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="role"
                          value={role.slug}
                          checked={isSelected}
                          onChange={(e) => setForm(prev => ({ ...prev, role: e.target.value }))}
                          className="sr-only"
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

              {isInvite && (
                <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-700 dark:text-blue-300">This invite can be updated before the agent accepts it.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3 shrink-0 bg-muted/30">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted rounded-lg transition-colors">
                Cancel
              </button>
              <button
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
                className="px-5 py-2 bg-[#25D366] hover:bg-[#20bd5a] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}