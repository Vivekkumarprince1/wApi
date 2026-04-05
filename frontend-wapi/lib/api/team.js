import { apiClient } from './client';

export const teamApi = {
  getMembers: () => apiClient.get('/team/members'),
  inviteMember: (data) => apiClient.post('/team/invite', data),
  updateRole: (memberId, role) => apiClient.put(`/team/members/${memberId}/role`, { role }),
  updateSettings: (memberId, settings) => apiClient.put(`/team/members/${memberId}/settings`, settings),
  removeMember: (memberId) => apiClient.delete(`/team/members/${memberId}`),
  getPermissions: () => apiClient.get('/team/permissions'),
};
