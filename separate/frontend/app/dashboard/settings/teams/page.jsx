'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, UserPlus, Shield, Search, Loader2, Trash2,
  Mail, Crown, Star, Eye, CheckCircle2, XCircle,
  Plus, RefreshCcw, UserCog, Layers, X,
  Edit2, ChevronDown, AlertCircle, ToggleLeft, ToggleRight
} from 'lucide-react';
import FlashLoader from '@/components/ui/FlashLoader';
import { get, post, put, del } from '@/lib/api';
import { toast } from '@/lib/toast';
import FeatureGate from '@/components/features/FeatureGate';
import LockedPage from '@/components/shared/LockedPage';
import { useAuthStore } from '@/store/authStore';

// ═══════════════════════════════════════
// ROLE CONFIG (Interakt style)
// ═══════════════════════════════════════
const ROLE_CONFIG = {
  owner:   { label: 'Owner',   color: '#F59E0B', bg: '#FEF3C7' },
  admin:   { label: 'Admin',   color: '#8B5CF6', bg: '#EDE9FE' },
  manager: { label: 'Manager', color: '#3B82F6', bg: '#DBEAFE' },
  agent:   { label: 'Agent',   color: '#10B981', bg: '#D1FAE5' },
  member:  { label: 'Member',  color: '#6B7280', bg: '#F3F4F6' },
  viewer:  { label: 'Viewer',  color: '#9CA3AF', bg: '#F9FAFB' },
};

const ASSIGNABLE_ROLES = ['admin', 'manager', 'agent', 'member', 'viewer'];

// ═══════════════════════════════════════
// MAIN CONTAINER
// ═══════════════════════════════════════
function TeamsContent() {
  const [activeTab, setActiveTab] = useState('agents');
  const [members, setMembers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [permissions, setPermissions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [lockedReason, setLockedReason] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { user } = useAuthStore();

  // Side panels
  const [showInvitePanel, setShowInvitePanel] = useState(false);
  const [showTeamPanel, setShowTeamPanel] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [editingMember, setEditingMember] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [membersRes, teamsRes, permsRes] = await Promise.allSettled([
        get('/team/members'),
        get('/team/teams'),
        get('/team/permissions')
      ]);
      if (membersRes.status === 'fulfilled') setMembers(membersRes.value?.members || []);
      if (teamsRes.status === 'fulfilled') setTeams(teamsRes.value?.teams || []);
      if (permsRes.status === 'fulfilled') setPermissions(permsRes.value?.roles || null);

      // Check if any critical endpoint returned 403
      const is403 = [membersRes, teamsRes].some(res => 
        res.status === 'rejected' && res.reason?.status === 403
      );
      
      if (is403) {
        setIsLocked(true);
        setLockedReason("You don't have permission to manage team settings.");
      }
    } catch (err) {
      console.error('Failed to load team data:', err);
      if (err.status === 403) {
        setIsLocked(true);
        setLockedReason("You don't have permission to manage team settings.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const tabs = [
    { id: 'agents', label: 'Agent Settings', count: members.length },
    { id: 'teams', label: 'Manage Teams', count: teams.length },
    { id: 'permissions', label: 'Roles & Permissions', count: null },
  ];

  if (loading) return <FlashLoader />;

  if (isLocked) {
    return (
      <LockedPage 
        title="Team Settings Locked"
        description={lockedReason}
        requiredRole="Manager"
        isUpgradeRequired={false}
      />
    );
  }

  return (
    <div className="h-full">
      {/* Top Bar — Interakt style clean header */}
      <div className="bg-card border-b border-border px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Team & User Management</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Manage agents, create teams, and control permissions</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadData} className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground" title="Refresh">
              <RefreshCcw className="h-4 w-4" />
            </button>
            {activeTab === 'agents' && (
              <button onClick={() => setShowInvitePanel(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-lg text-sm font-medium transition-colors"
              >
                <UserPlus className="h-4 w-4" /> Create Agent
              </button>
            )}
            {activeTab === 'teams' && (
              <button onClick={() => { setEditingTeam(null); setShowTeamPanel(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Plus className="h-4 w-4" /> Create Team
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tab Bar — Interakt underline tabs */}
      <div className="bg-card border-b border-border px-6">
        <div className="max-w-7xl mx-auto flex items-center gap-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-[#25D366] text-[#25D366]'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
              {tab.count !== null && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-muted text-muted-foreground text-[10px] font-semibold rounded">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          {activeTab === 'agents' && (
            <AgentsTab
              members={members} setMembers={setMembers}
              searchQuery={searchQuery} setSearchQuery={setSearchQuery}
              onRefresh={loadData} onEditMember={setEditingMember}
            />
          )}
          {activeTab === 'teams' && (
            <TeamsTab teams={teams} onRefresh={loadData}
              onEdit={(team) => { setEditingTeam(team); setShowTeamPanel(true); }}
            />
          )}
          {activeTab === 'permissions' && <PermissionsTab permissions={permissions} />}
        </div>
      </div>

      {/* Side Panels */}
      {showInvitePanel && (
        <InvitePanel onClose={() => setShowInvitePanel(false)} onSuccess={() => { setShowInvitePanel(false); loadData(); }} />
      )}
      {showTeamPanel && (
        <TeamPanel
          onClose={() => { setShowTeamPanel(false); setEditingTeam(null); }}
          onSuccess={() => { setShowTeamPanel(false); setEditingTeam(null); loadData(); }}
          members={members} team={editingTeam}
        />
      )}
      {editingMember && (
        <EditMemberPanel member={editingMember}
          onClose={() => setEditingMember(null)}
          onSuccess={() => { setEditingMember(null); loadData(); }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// AGENTS TAB — Interakt table layout
// ═══════════════════════════════════════
function AgentsTab({ members, setMembers, searchQuery, setSearchQuery, onRefresh, onEditMember }) {
  const handleRemove = async (memberId, name) => {
    if (!confirm(`Remove ${name} from this workspace? They will lose all access.`)) return;
    try {
      await del(`/team/members/${memberId}`);
      setMembers(prev => prev.filter(m => m._id !== memberId));
      toast?.success?.('Member removed');
    } catch (err) {
      toast?.error?.(err.message || 'Failed to remove');
    }
  };

  const filtered = searchQuery
    ? members.filter(m =>
      m.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.role?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    : members;

  return (
    <div>
      {/* Search bar */}
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text" placeholder="Search by name, email or role..."
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366]"
          />
        </div>
        <span className="text-sm text-muted-foreground">{filtered.length} agent{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Agent</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Role</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Open Chats</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-muted-foreground text-sm">No agents found</td></tr>
            ) : (
              filtered.map(member => {
                const cfg = ROLE_CONFIG[member.role] || ROLE_CONFIG.member;
                return (
                  <tr key={member._id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    {/* Name + Avatar */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold text-white"
                            style={{ backgroundColor: cfg.color }}>
                            {member.name?.[0]?.toUpperCase() || 'U'}
                          </div>
                          <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${
                            member.isOnline ? 'bg-emerald-500' : member.status === 'invited' ? 'bg-amber-400' : 'bg-gray-300'
                          }`} />
                        </div>
                        <span className="text-sm font-medium text-foreground">{member.name || 'Unnamed'}</span>
                      </div>
                    </td>
                    {/* Email */}
                    <td className="px-4 py-3 text-sm text-muted-foreground">{member.email}</td>
                    {/* Role badge */}
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                        style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                        {member.role === 'owner' && <Crown className="h-3 w-3" />}
                        {cfg.label}
                      </span>
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                        member.isOnline ? 'text-emerald-600' : member.status === 'invited' ? 'text-amber-600' : 'text-gray-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          member.isOnline ? 'bg-emerald-500' : member.status === 'invited' ? 'bg-amber-400' : 'bg-gray-300'
                        }`} />
                        {member.isOnline ? 'Online' : member.status === 'invited' ? 'Invited' : 'Offline'}
                      </span>
                    </td>
                    {/* Open Chats */}
                    <td className="px-4 py-3 text-center text-sm text-muted-foreground">
                      {member.openConversations || 0}
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {member.role !== 'owner' && (
                          <>
                            <button onClick={() => onEditMember(member)}
                              className="p-1.5 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-foreground" title="Edit">
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => handleRemove(member._id, member.name)}
                              className="p-1.5 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md transition-colors text-muted-foreground hover:text-red-600" title="Remove">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// TEAMS TAB — Interakt card grid
// ═══════════════════════════════════════
function TeamsTab({ teams, onRefresh, onEdit }) {
  const handleDelete = async (teamId, name) => {
    if (!confirm(`Delete team "${name}"? Members will be unassigned.`)) return;
    try {
      await del(`/team/teams/${teamId}`);
      toast?.success?.('Team deleted');
      onRefresh();
    } catch (err) {
      toast?.error?.(err.message || 'Failed to delete');
    }
  };

  if (teams.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg p-12 text-center">
        <Layers className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
        <h3 className="text-base font-medium text-foreground mb-1">No teams created yet</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Group agents into teams for better organization and contact visibility control. Click "Create Team" to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {teams.map(team => (
        <div key={team._id} className="bg-card border border-border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
          {/* Header */}
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#25D366]/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-[#25D366]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">{team.name}</h3>
                <p className="text-[11px] text-muted-foreground">{team.members?.length || 0} members</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => onEdit(team)} className="p-1.5 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-foreground">
                <Edit2 className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => handleDelete(team._id, team.name)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md transition-colors text-muted-foreground hover:text-red-600">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Config tags */}
          <div className="px-4 py-2 flex gap-2 border-b border-border/50">
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${
              team.visibility === 'team_only' ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
            }`}>
              {team.visibility === 'team_only' ? 'Team Only' : 'All Contacts'}
            </span>
            {team.autoAssign?.enabled && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400">
                Auto-assign: {team.autoAssign.strategy?.replace('_', ' ')}
              </span>
            )}
          </div>

          {/* Members */}
          <div className="px-4 py-3">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Members</div>
            {(!team.members || team.members.length === 0) ? (
              <p className="text-xs text-muted-foreground italic">No members</p>
            ) : (
              <div className="space-y-1.5">
                {team.members.slice(0, 5).map((m, idx) => {
                  const user = m.user || {};
                  const cfg = ROLE_CONFIG[user.role] || ROLE_CONFIG.member;
                  return (
                    <div key={user._id || idx} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white" style={{ backgroundColor: cfg.color }}>
                          {user.name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <span className="text-xs font-medium text-foreground">{user.name || user.email}</span>
                      </div>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                        m.role === 'lead' ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' : 'bg-muted text-muted-foreground'
                      }`}>
                        {m.role === 'lead' ? '★ Lead' : 'Member'}
                      </span>
                    </div>
                  );
                })}
                {team.members.length > 5 && (
                  <p className="text-[10px] text-muted-foreground mt-1">+{team.members.length - 5} more</p>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════
// PERMISSIONS TAB — Interakt grid
// ═══════════════════════════════════════
function PermissionsTab({ permissions }) {
  if (!permissions) return (
    <div className="bg-card border border-border rounded-lg p-12 text-center">
      <Shield className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
      <p className="text-sm text-muted-foreground">Unable to load permissions</p>
    </div>
  );

  const roleOrder = ['owner', 'admin', 'manager', 'agent', 'viewer'];
  const allPerms = [...new Set(roleOrder.flatMap(r => permissions[r]?.permissions || []))].sort();
  const categories = {};
  allPerms.forEach(perm => {
    const [cat] = perm.split('.');
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(perm);
  });

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <h3 className="text-sm font-semibold text-foreground">Roles & Permissions Matrix</h3>
        <p className="text-xs text-muted-foreground mt-0.5">What each role can access in your workspace</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider min-w-[200px] sticky left-0 bg-muted/50">Permission</th>
              {roleOrder.map(role => {
                const cfg = ROLE_CONFIG[role];
                return (
                  <th key={role} className="px-4 py-3 text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                      {cfg.label}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {Object.entries(categories).map(([cat, perms]) => (
              <React.Fragment key={cat}>
                <tr className="bg-muted/20">
                  <td colSpan={roleOrder.length + 1} className="px-4 py-2 text-[10px] font-bold text-[#25D366] uppercase tracking-wider">{cat}</td>
                </tr>
                {perms.map(perm => (
                  <tr key={perm} className="border-b border-border/30 hover:bg-muted/10">
                    <td className="px-4 py-2.5 text-xs text-foreground capitalize sticky left-0 bg-card">{perm.split('.').pop().replace(/_/g, ' ')}</td>
                    {roleOrder.map(role => (
                      <td key={role} className="px-4 py-2.5 text-center">
                        {permissions[role]?.permissions?.includes(perm)
                          ? <CheckCircle2 className="h-4 w-4 text-[#25D366] mx-auto" />
                          : <XCircle className="h-4 w-4 text-gray-200 dark:text-gray-700 mx-auto" />
                        }
                      </td>
                    ))}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// SLIDE-OUT: INVITE AGENT (Interakt style)
// ═══════════════════════════════════════
function InvitePanel({ onClose, onSuccess }) {
  const [form, setForm] = useState({ name: '', email: '', role: 'agent', phone: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.name) return;
    try {
      setSaving(true);
      await post('/team/invite', { email: form.email, name: form.name, role: form.role });
      toast?.success?.(`Agent ${form.name} invited successfully`);
      onSuccess();
    } catch (err) {
      toast?.error?.(err.message || 'Failed to invite');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="ml-auto relative w-full max-w-md bg-card border-l border-border shadow-2xl h-full flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
          <h2 className="text-base font-semibold text-foreground">Create Agent</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-md transition-colors"><X className="h-4 w-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">First & Last Name <span className="text-red-500">*</span></label>
            <input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
              required placeholder="e.g. Priya Sharma"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366]"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Email ID (Login ID) <span className="text-red-500">*</span></label>
            <input type="email" value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))}
              required placeholder="priya@company.com"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366]"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Contact Number</label>
            <input type="tel" value={form.phone} onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))}
              placeholder="+91 98765 43210"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Assign Role <span className="text-red-500">*</span></label>
            <div className="space-y-2">
              {ASSIGNABLE_ROLES.map(role => {
                const cfg = ROLE_CONFIG[role];
                return (
                  <label key={role}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      form.role === role ? 'border-[#25D366] bg-[#25D366]/5' : 'border-border hover:border-gray-300'
                    }`}
                  >
                    <input type="radio" name="role" value={role} checked={form.role === role}
                      onChange={(e) => setForm(p => ({ ...p, role: e.target.value }))}
                      className="sr-only"
                    />
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      form.role === role ? 'border-[#25D366]' : 'border-gray-300'
                    }`}>
                      {form.role === role && <div className="w-2 h-2 rounded-full bg-[#25D366]" />}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-foreground">{cfg.label}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {role === 'admin' && 'Full access to settings, team, and billing'}
                        {role === 'manager' && 'Manages team, templates, and campaigns'}
                        {role === 'agent' && 'Handles conversations and contacts'}
                        {role === 'member' && 'Basic workspace access'}
                        {role === 'viewer' && 'Read-only access to analytics'}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700 dark:text-blue-300">An email invitation will be sent with login credentials. The agent will appear as "Invited" until they sign in.</p>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3 shrink-0 bg-muted/30">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted rounded-lg transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={saving || !form.name || !form.email}
            className="px-5 py-2 bg-[#25D366] hover:bg-[#20bd5a] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {saving ? 'Saving...' : 'Save Agent'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// SLIDE-OUT: EDIT MEMBER (Interakt: Edit Agent)
// ═══════════════════════════════════════
function EditMemberPanel({ member, onClose, onSuccess }) {
  const [form, setForm] = useState({
    name: member.name || '',
    phone: member.phone || '',
    role: member.role,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      await put(`/team/members/${member._id}`, form);
      toast?.success?.(`${form.name} updated successfully`);
      onSuccess();
    } catch (err) {
      toast?.error?.(err.message || 'Failed to update agent');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="ml-auto relative w-full max-w-md bg-card border-l border-border shadow-2xl h-full flex flex-col animate-in slide-in-from-right duration-300">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
          <h2 className="text-base font-semibold text-foreground">Edit Agent</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-md transition-colors"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Agent avatar header */}
          <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg border border-border/50">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
              style={{ backgroundColor: (ROLE_CONFIG[member.role] || ROLE_CONFIG.member).color }}>
              {member.name?.[0]?.toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-medium text-foreground">{member.name}</div>
              <div className="text-xs text-muted-foreground">{member.email}</div>
            </div>
          </div>

          {/* Editable fields */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Name</label>
            <input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366]"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Phone</label>
            <input value={form.phone} onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))}
              placeholder="+91 98765 43210"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Role</label>
            <div className="space-y-2">
              {ASSIGNABLE_ROLES.map(r => {
                const cfg = ROLE_CONFIG[r];
                return (
                  <label key={r}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      form.role === r ? 'border-[#25D366] bg-[#25D366]/5' : 'border-border hover:border-gray-300'
                    }`}
                  >
                    <input type="radio" name="role" value={r} checked={form.role === r}
                      onChange={() => setForm(p => ({ ...p, role: r }))} className="sr-only"
                    />
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${form.role === r ? 'border-[#25D366]' : 'border-gray-300'}`}>
                      {form.role === r && <div className="w-2 h-2 rounded-full bg-[#25D366]" />}
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-medium text-foreground">{cfg.label}</span>
                      <div className="text-[10px] text-muted-foreground">
                        {r === 'admin' && 'Full access to settings, team, and billing'}
                        {r === 'manager' && 'Manages team, templates, and campaigns'}
                        {r === 'agent' && 'Handles conversations and contacts'}
                        {r === 'member' && 'Basic workspace access'}
                        {r === 'viewer' && 'Read-only access to analytics'}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3 shrink-0 bg-muted/30">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted rounded-lg transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 bg-[#25D366] hover:bg-[#20bd5a] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// SLIDE-OUT: CREATE/EDIT TEAM
// ═══════════════════════════════════════
function TeamPanel({ onClose, onSuccess, members, team }) {
  const isEdit = !!team;
  const [form, setForm] = useState({
    name: team?.name || '',
    description: team?.description || '',
    visibility: team?.visibility || 'team_only',
    autoAssign: team?.autoAssign || { enabled: false, strategy: 'round_robin' },
    members: team?.members?.map(m => ({ user: m.user?._id || m.user, role: m.role })) || []
  });
  const [saving, setSaving] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');

  const toggleMember = (userId) => {
    setForm(prev => {
      const exists = prev.members.find(m => m.user === userId);
      if (exists) return { ...prev, members: prev.members.filter(m => m.user !== userId) };
      return { ...prev, members: [...prev.members, { user: userId, role: 'member' }] };
    });
  };

  const toggleMemberRole = (userId) => {
    setForm(prev => ({
      ...prev,
      members: prev.members.map(m => m.user === userId ? { ...m, role: m.role === 'lead' ? 'member' : 'lead' } : m)
    }));
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!form.name.trim()) return;
    try {
      setSaving(true);
      if (isEdit) {
        await put(`/team/teams/${team._id}`, form);
        toast?.success?.('Team updated');
      } else {
        await post('/team/teams', form);
        toast?.success?.('Team created');
      }
      onSuccess();
    } catch (err) {
      toast?.error?.(err.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const filteredMembers = memberSearch
    ? members.filter(m => m.role !== 'owner' && (m.name?.toLowerCase().includes(memberSearch.toLowerCase()) || m.email?.toLowerCase().includes(memberSearch.toLowerCase())))
    : members.filter(m => m.role !== 'owner');

  return (
    <div className="fixed inset-0 z-[100] flex">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="ml-auto relative w-full max-w-lg bg-card border-l border-border shadow-2xl h-full flex flex-col animate-in slide-in-from-right duration-300">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
          <h2 className="text-base font-semibold text-foreground">{isEdit ? 'Edit Team' : 'Create Team'}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-md transition-colors"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Team Name <span className="text-red-500">*</span></label>
            <input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
              required placeholder="e.g. North Zone Sales"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366]"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Description</label>
            <input value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Optional description"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366]"
            />
          </div>

          {/* Visibility */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Contact Visibility</label>
            <div className="grid grid-cols-2 gap-2">
              {[{ val: 'team_only', label: 'Team Only', desc: 'Agents see only team contacts' },
                { val: 'all', label: 'All Contacts', desc: 'Agents see all workspace contacts' }
              ].map(opt => (
                <label key={opt.val}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    form.visibility === opt.val ? 'border-[#25D366] bg-[#25D366]/5' : 'border-border hover:border-gray-300'
                  }`}
                >
                  <input type="radio" name="visibility" value={opt.val}
                    checked={form.visibility === opt.val}
                    onChange={() => setForm(p => ({ ...p, visibility: opt.val }))}
                    className="sr-only"
                  />
                  <div className="text-sm font-medium text-foreground">{opt.label}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{opt.desc}</div>
                </label>
              ))}
            </div>
          </div>

          {/* Auto-assign */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Auto-Assignment</label>
            <div className="p-3 border border-border rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground font-medium">Auto-assign leads</span>
                <button type="button"
                  onClick={() => setForm(p => ({ ...p, autoAssign: { ...p.autoAssign, enabled: !p.autoAssign.enabled } }))}
                  className="flex items-center"
                >
                  {form.autoAssign.enabled
                    ? <ToggleRight className="h-6 w-6 text-[#25D366]" />
                    : <ToggleLeft className="h-6 w-6 text-gray-300" />
                  }
                </button>
              </div>
              {form.autoAssign.enabled && (
                <select value={form.autoAssign.strategy}
                  onChange={(e) => setForm(p => ({ ...p, autoAssign: { ...p.autoAssign, strategy: e.target.value } }))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none"
                >
                  <option value="round_robin">Round Robin</option>
                  <option value="least_busy">Least Busy</option>
                  <option value="random">Random</option>
                </select>
              )}
            </div>
          </div>

          {/* Select Members */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Select Agents <span className="text-muted-foreground">({form.members.length} selected)</span>
            </label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input type="text" placeholder="Search agents..."
                value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-[#25D366]"
              />
            </div>
            <div className="border border-border rounded-lg max-h-[250px] overflow-y-auto divide-y divide-border/50">
              {filteredMembers.map(m => {
                const isSelected = form.members.some(fm => fm.user === m._id);
                const entry = form.members.find(fm => fm.user === m._id);
                const cfg = ROLE_CONFIG[m.role] || ROLE_CONFIG.member;
                return (
                  <div key={m._id} className={`flex items-center justify-between px-3 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors ${isSelected ? 'bg-[#25D366]/5' : ''}`}
                    onClick={() => toggleMember(m._id)}>
                    <div className="flex items-center gap-2.5">
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${isSelected ? 'bg-[#25D366] border-[#25D366]' : 'border-gray-300'}`}>
                        {isSelected && <CheckCircle2 className="h-3 w-3 text-white" />}
                      </div>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white" style={{ backgroundColor: cfg.color }}>
                        {m.name?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs font-medium text-foreground">{m.name}</div>
                        <div className="text-[10px] text-muted-foreground">{m.email}</div>
                      </div>
                    </div>
                    {isSelected && (
                      <button type="button"
                        onClick={(e) => { e.stopPropagation(); toggleMemberRole(m._id); }}
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded transition-colors ${
                          entry?.role === 'lead' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' : 'bg-muted text-muted-foreground hover:bg-amber-50 hover:text-amber-700'
                        }`}
                      >
                        {entry?.role === 'lead' ? '★ Lead' : 'Member → Lead'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3 shrink-0 bg-muted/30">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted rounded-lg transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={saving || !form.name.trim()}
            className="px-5 py-2 bg-[#25D366] hover:bg-[#20bd5a] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >{saving ? 'Saving...' : isEdit ? 'Update Team' : 'Create Team'}</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════
export default function TeamsSettingsPage() {
  return (
    <FeatureGate feature="team">
      <TeamsContent />
    </FeatureGate>
  );
}
