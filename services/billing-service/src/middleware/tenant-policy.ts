export function canAccessWorkspace(input: {
  requestedWorkspaceId?: string;
  authenticatedWorkspaceId?: string;
  systemRole?: string;
  workspaceRole?: string;
}) {
  if (input.systemRole === 'super_admin' || input.workspaceRole === 'system') return true;
  return !!input.requestedWorkspaceId && input.requestedWorkspaceId === input.authenticatedWorkspaceId;
}