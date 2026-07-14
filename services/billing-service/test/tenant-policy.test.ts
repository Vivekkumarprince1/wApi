import test from 'node:test';
import assert from 'node:assert/strict';
import { canAccessWorkspace } from '../src/middleware/tenant-policy';

test('rejects cross-workspace billing access', () => {
  assert.equal(canAccessWorkspace({ requestedWorkspaceId: 'workspace-b', authenticatedWorkspaceId: 'workspace-a', systemRole: 'user', workspaceRole: 'owner' }), false);
});

test('allows the authenticated workspace and explicit internal system operations', () => {
  assert.equal(canAccessWorkspace({ requestedWorkspaceId: 'workspace-a', authenticatedWorkspaceId: 'workspace-a', systemRole: 'user', workspaceRole: 'owner' }), true);
  assert.equal(canAccessWorkspace({ requestedWorkspaceId: 'workspace-b', authenticatedWorkspaceId: 'workspace-a', workspaceRole: 'system' }), true);
});