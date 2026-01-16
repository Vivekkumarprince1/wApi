'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Trash2, Plus, CheckCircle, XCircle } from 'lucide-react';

/**
 * RBAC Team Management Component
 * Week 2: Role-based access control UI
 * 
 * Features:
 * - List team members with roles
 * - Add new team member
 * - Change member role (Owner → Manager → Agent → Viewer)
 * - Remove member
 * - View permissions per role
 */

const ROLES = [
  {
    id: 'owner',
    name: 'Owner',
    description: 'Full access, can manage billing',
    permissions: ['admin.manage', 'messaging.send', 'templates.manage', 'billing.manage', 'team.manage'],
    canAssign: true,
  },
  {
    id: 'manager',
    name: 'Manager',
    description: 'Can manage team, messages, templates',
    permissions: ['messaging.send', 'templates.manage', 'team.manage', 'analytics.view', 'billing.view'],
    canAssign: true,
  },
  {
    id: 'agent',
    name: 'Agent',
    description: 'Can send messages and view conversations',
    permissions: ['messaging.send', 'conversations.view', 'contacts.manage'],
    canAssign: true,
  },
  {
    id: 'viewer',
    name: 'Viewer',
    description: 'Read-only access',
    permissions: ['conversations.view', 'contacts.view', 'analytics.view'],
    canAssign: false,
  },
];

export function RBACTeamManagement() {
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedRole, setSelectedRole] = useState('agent');
  const [newMemberEmail, setNewMemberEmail] = useState('');

  // Load team members
  useEffect(() => {
    loadTeamMembers();
  }, []);

  const loadTeamMembers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/admin/team/members', {
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      setTeamMembers(data.members || []);
    } catch (err) {
      setError('Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!newMemberEmail) return;

    try {
      const response = await fetch('/api/v1/admin/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newMemberEmail,
          role: selectedRole,
        }),
      });

      if (!response.ok) throw new Error('Failed to invite member');

      setNewMemberEmail('');
      setShowAddMember(false);
      await loadTeamMembers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleChangeRole = async (memberId, newRole) => {
    try {
      const response = await fetch(`/api/v1/admin/team/members/${memberId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) throw new Error('Failed to update role');
      await loadTeamMembers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!confirm('Remove this team member?')) return;

    try {
      const response = await fetch(`/api/v1/admin/team/members/${memberId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to remove member');
      await loadTeamMembers();
    } catch (err) {
      setError(err.message);
    }
  };

  const getRoleConfig = (roleId) => ROLES.find((r) => r.id === roleId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Team Management</h2>
          <p className="text-gray-600">Manage team members and their permissions</p>
        </div>
        <Button onClick={() => setShowAddMember(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Member
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Add Member Form */}
      {showAddMember && (
        <Card className="bg-blue-50">
          <CardHeader>
            <CardTitle>Invite Team Member</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="Enter email address"
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-lg"
              />
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAddMember} variant="default">
                Send Invite
              </Button>
              <Button onClick={() => setShowAddMember(false)} variant="outline">
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team Members List */}
      <div className="space-y-3">
        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : teamMembers.length === 0 ? (
          <p className="text-gray-500">No team members yet</p>
        ) : (
          teamMembers.map((member) => {
            const roleConfig = getRoleConfig(member.role);
            return (
              <Card key={member._id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                          {member.name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold">{member.name || member.email}</p>
                          <p className="text-sm text-gray-600">{member.email}</p>
                        </div>
                      </div>
                    </div>

                    {/* Role Selector */}
                    <div className="flex items-center gap-3">
                      {member.status === 'invited' ? (
                        <Badge variant="secondary">Invited</Badge>
                      ) : (
                        <Select value={member.role} onValueChange={(newRole) => handleChangeRole(member._id, newRole)}>
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map((role) => (
                              <SelectItem key={role.id} value={role.id}>
                                {role.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      {/* Remove Button */}
                      {member.email !== 'owner@workspace.local' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveMember(member._id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Role Reference */}
      <Card>
        <CardHeader>
          <CardTitle>Role Permissions</CardTitle>
          <CardDescription>Overview of permissions for each role</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {ROLES.map((role) => (
              <div key={role.id} className="pb-4 border-b last:border-0">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-semibold">{role.name}</h4>
                    <p className="text-sm text-gray-600">{role.description}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {role.permissions.map((perm) => (
                    <Badge key={perm} variant="outline" className="text-xs">
                      {perm}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default RBACTeamManagement;
