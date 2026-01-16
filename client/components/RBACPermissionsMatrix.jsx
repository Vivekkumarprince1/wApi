'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle } from 'lucide-react';

/**
 * RBAC Permissions Matrix Component
 * Visual reference for all permissions across all roles
 */

const PERMISSIONS_MATRIX = [
  {
    category: 'Messaging',
    permissions: [
      { id: 'messaging.send', label: 'Send Messages', roles: { owner: true, manager: true, agent: true, viewer: false } },
      { id: 'messaging.delete', label: 'Delete Messages', roles: { owner: true, manager: true, agent: false, viewer: false } },
    ],
  },
  {
    category: 'Templates',
    permissions: [
      { id: 'templates.create', label: 'Create Templates', roles: { owner: true, manager: true, agent: false, viewer: false } },
      { id: 'templates.approve', label: 'Approve Templates', roles: { owner: true, manager: true, agent: false, viewer: false } },
      { id: 'templates.view', label: 'View Templates', roles: { owner: true, manager: true, agent: true, viewer: true } },
    ],
  },
  {
    category: 'Conversations',
    permissions: [
      { id: 'conversations.view', label: 'View Conversations', roles: { owner: true, manager: true, agent: true, viewer: true } },
      { id: 'conversations.assign', label: 'Assign Conversations', roles: { owner: true, manager: true, agent: false, viewer: false } },
    ],
  },
  {
    category: 'Team & Admin',
    permissions: [
      { id: 'team.manage', label: 'Manage Team Members', roles: { owner: true, manager: true, agent: false, viewer: false } },
      { id: 'admin.manage', label: 'Admin Settings', roles: { owner: true, manager: false, agent: false, viewer: false } },
    ],
  },
  {
    category: 'Billing',
    permissions: [
      { id: 'billing.view', label: 'View Billing', roles: { owner: true, manager: true, agent: false, viewer: false } },
      { id: 'billing.manage', label: 'Manage Billing', roles: { owner: true, manager: false, agent: false, viewer: false } },
    ],
  },
  {
    category: 'Analytics',
    permissions: [
      { id: 'analytics.view', label: 'View Analytics', roles: { owner: true, manager: true, agent: false, viewer: true } },
      { id: 'analytics.export', label: 'Export Reports', roles: { owner: true, manager: true, agent: false, viewer: false } },
    ],
  },
];

const ROLES = ['owner', 'manager', 'agent', 'viewer'];
const ROLE_LABELS = { owner: 'Owner', manager: 'Manager', agent: 'Agent', viewer: 'Viewer' };

export function RBACPermissionsMatrix() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Permissions Matrix</CardTitle>
        <CardDescription>Complete overview of role-based permissions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {PERMISSIONS_MATRIX.map((category) => (
            <div key={category.category}>
              <h3 className="font-semibold text-lg mb-3 text-gray-700">{category.category}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3">Permission</th>
                      {ROLES.map((role) => (
                        <th key={role} className="text-center py-2 px-3">
                          <span className="font-semibold">{ROLE_LABELS[role]}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {category.permissions.map((perm) => (
                      <tr key={perm.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-3 font-medium">{perm.label}</td>
                        {ROLES.map((role) => (
                          <td key={`${perm.id}-${role}`} className="text-center py-3 px-3">
                            {perm.roles[role] ? (
                              <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                            ) : (
                              <XCircle className="w-5 h-5 text-gray-300 mx-auto" />
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default RBACPermissionsMatrix;
