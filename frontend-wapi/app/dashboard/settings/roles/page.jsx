'use client';

import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Users, 
  ShieldCheck, 
  UserPlus, 
  MoreVertical,
  ChevronRight,
  User,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Info
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const ROLE_CONFIG = {
  owner: { label: 'Owner', description: 'Full access to all settings and billing.', color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/30' },
  admin: { label: 'Admin', description: 'Can manage team and all settings except billing.', color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30' },
  manager: { label: 'Manager', description: 'Can manage conversations and view reports.', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' },
  agent: { label: 'Agent', description: 'Can send and receive messages.', color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30' },
  viewer: { label: 'Viewer', description: 'ReadOnly access to conversations and analytics.', color: 'text-slate-600 bg-slate-50 dark:bg-slate-950/30' },
};

const RolesContent = () => {
    const { user: currentUser } = useAuthStore();
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState(null);

    const fetchMembers = async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/workspace/team/members');
            setMembers(data.members || []);
        } catch (err) {
            console.error('Failed to fetch members:', err);
            toast.error('Failed to load team members');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMembers();
    }, []);

    const handleRoleChange = async (memberId, newRole) => {
        try {
            setUpdatingId(memberId);
            await api.put(`/workspace/team/members/${memberId}/role`, { role: newRole });
            toast.success('Role updated successfully');
            fetchMembers();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update role');
        } finally {
            setUpdatingId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center">
                            <Shield className="w-7 h-7 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-foreground">Roles & Permissions</h1>
                            <p className="text-muted-foreground mt-1">Manage team roles and access levels for your workspace.</p>
                        </div>
                    </div>
                </div>

                {/* Role Definitions Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
                    {Object.entries(ROLE_CONFIG).map(([key, config]) => (
                        <div key={key} className="p-4 rounded-xl border border-border/50 bg-card/50 hover:bg-card transition-colors flex gap-4">
                            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0", config.color)}>
                                <ShieldCheck className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-sm capitalize">{config.label}</h3>
                                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                    {config.description}
                                </p>
                            </div>
                        </div>
                    ))}
                    <div className="p-4 rounded-xl border border-dashed border-border flex items-center justify-center bg-transparent group hover:border-primary/50 transition-colors cursor-pointer">
                        <div className="flex flex-col items-center gap-2">
                             <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                                <Info className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                             </div>
                             <span className="text-xs font-medium text-muted-foreground group-hover:text-primary">Custom Roles (Soon)</span>
                        </div>
                    </div>
                </div>

                {/* Members List Section */}
                <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                    <div className="px-6 py-4 border-b border-border bg-muted/30 flex items-center justify-between">
                        <h2 className="font-semibold flex items-center gap-2">
                            <Users className="w-4 h-4 text-primary" />
                           Team Members
                           <span className="ml-2 px-2 py-0.5 text-[10px] font-bold bg-primary/10 text-primary rounded-full">
                                {members.length}
                           </span>
                        </h2>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-muted-foreground text-xs uppercase tracking-wider font-semibold border-b border-border">
                                    <th className="px-6 py-4">User</th>
                                    <th className="px-6 py-4">Current Role</th>
                                    <th className="px-6 py-4">Access Level</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {members.map((member) => (
                                    <tr key={member._id} className="hover:bg-muted/20 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                    {member.name?.charAt(0) || <User className="w-5 h-5" />}
                                                </div>
                                                <div>
                                                    <div className="font-medium text-sm flex items-center gap-1.5">
                                                        {member.name}
                                                        {member._id === currentUser.id && (
                                                            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded uppercase font-bold text-muted-foreground">You</span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">{member.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className={cn(
                                                "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold",
                                                ROLE_CONFIG[member.role]?.color || 'bg-muted text-muted-foreground'
                                            )}>
                                                {ROLE_CONFIG[member.role]?.label || member.role}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                {member.role === 'owner' ? (
                                                    <span className="text-xs text-purple-600 font-medium flex items-center gap-1">
                                                        <ShieldCheck className="w-3 h-3" /> Root Access
                                                    </span>
                                                ) : (
                                                    <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                                                        <div 
                                                            className={cn(
                                                                "h-full transition-all duration-1000",
                                                                member.role === 'admin' ? "w-[85%] bg-blue-500" :
                                                                member.role === 'manager' ? "w-[60%] bg-emerald-500" :
                                                                member.role === 'agent' ? "w-[30%] bg-amber-500" : "w-[15%] bg-slate-400"
                                                            )}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {/* Prevent changing own role if owner, or if current user is not owner/admin */}
                                            {member._id === currentUser.id ? (
                                                <span className="text-xs text-muted-foreground italic mr-4">Pinned Access</span>
                                            ) : (
                                                <select
                                                    value={member.role}
                                                    onChange={(e) => handleRoleChange(member._id, e.target.value)}
                                                    disabled={updatingId === member._id || !['owner', 'admin'].includes(currentUser.role)}
                                                    className="text-xs bg-background border border-border rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-primary outline-none transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {Object.keys(ROLE_CONFIG).map(role => (
                                                        <option key={role} value={role}>{ROLE_CONFIG[role].label}</option>
                                                    ))}
                                                </select>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer Tip */}
                <div className="mt-6 flex items-start gap-3 p-4 bg-primary/5 rounded-xl border border-primary/10">
                    <AlertCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-medium text-primary">Granular Rights for Agents</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            You can further restrict an Agent's access to specific Tags or Phone Numbers via the Team Management section.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default function RolesSettingsPage() {
  return <RolesContent />;
}
