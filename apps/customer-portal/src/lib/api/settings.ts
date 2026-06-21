import api from './client';

/** Axios interceptor already returns JSON body; many routes wrap payloads in `{ data }`. */
function unwrapData<T = any>(res: any): T {
  if (res && typeof res === 'object' && 'data' in res && res.data !== undefined) {
    return res.data as T;
  }
  return res as T;
}

export interface TeamMember {
  _id: string;
  user: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    status?: string;
  };
  role: 'lead' | 'member';
  addedAt: string;
}

// Workspace Profile
export const getWhatsappProfile = () => api.get<any>('/workspace/profile').then(unwrapData);
export const updateWhatsappProfile = (data: any) => api.patch<any>('/workspace/profile', data);
export const syncWhatsappProfile = () => api.post<any>('/workspace/profile/sync');
export const updateWhatsappDisplayName = (name: string) => api.patch<any>('/workspace/profile/display-name', { name });

// Tags
export const getTags = () => api.get<any>('/workspace/tags').then(unwrapData);
export const createTag = (data: any) => api.post<any>('/workspace/tags', data);
export const deleteTag = (id: string) => api.delete<any>(`/workspace/tags/${id}`);

// Developer Settings — owned by automation-service (gateway /api/v1/developer)
export const getDeveloperSettings = () => api.get<any>('/developer/settings').then(unwrapData);
export const updateDeveloperSettings = (data: any) => api.patch<any>('/developer/settings', data);
export const getDeveloperKeys = () => api.get<any>('/developer/keys').then(unwrapData);
export const createDeveloperKey = (name: string) => api.post<any>('/developer/keys', { name });
export const deleteDeveloperKey = (id: string) => api.delete<any>(`/developer/keys/${id}`);

// Roles & Permissions
export const getRoles = () => api.get<any>('/workspace/roles').then(unwrapData);
export const createRole = (data: any) => api.post<any>('/workspace/roles', data);
export const updateRole = (id: string, data: any) => api.patch<any>(`/workspace/roles/${id}`, data);
export const deleteRole = (id: string) => api.delete<any>(`/workspace/roles/${id}`);
export const getPermissionsMatrix = () => api.get<any>('/workspace/roles/matrix').then(unwrapData);

// Teams
export const getTeams = () => api.get<any>('/workspace/teams').then(unwrapData);
export const createTeam = (data: any) => api.post<any>('/workspace/teams', data);
export const updateTeam = (id: string, data: any) => api.patch<any>(`/workspace/teams/${id}`, data);
export const deleteTeam = (id: string) => api.delete<any>(`/workspace/teams/${id}`);

// Members
export const getTeamMembers = () => api.get<any>('/workspace/members').then(unwrapData);
export const inviteTeamMember = (data: any) => api.post<any>('/workspace/members/invite', data);
export const updateMember = (id: string, data: any) => api.patch<any>(`/workspace/members/${id}`, data);
export const updateMemberRole = (id: string, role: string) => api.patch<any>(`/workspace/members/${id}/role`, { role });
export const deleteMember = (id: string) => api.delete<any>(`/workspace/members/${id}`);
export const getMemberPermissions = (memberId: string) =>
  api.get<any>(`/workspace/members/${memberId}/permissions`).then(unwrapData);
export const updateMemberPermissions = (memberId: string, permissions: any) =>
  api.patch<any>(`/workspace/members/${memberId}/permissions`, { permissions });

// WABA Settings
export interface WABASettings { id?: string; [key: string]: any; }
export const getWABASettings = () =>
  api.get<any>('/workspace/waba').then((res: any) => res.waba || unwrapData(res));
export const updateWABASettings = (data: any) => api.patch<any>('/workspace/waba', data);
export const testWABAConnection = () => api.post<any>('/workspace/waba/test');

// Webhooks
export const getWhatsappSubscriptions = () => api.get<any>('/workspace/webhooks');
export const createWhatsappSubscription = (data: any) => api.post<any>('/workspace/webhooks', data);
export const updateWhatsappSubscription = (id: string | any, data?: any) => {
  if (typeof id === 'object' && !data) {
    return api.patch<any>(`/workspace/webhooks/${id.subscriptionId}`, id);
  }
  return api.patch<any>(`/workspace/webhooks/${id}`, data);
};
export const deleteWhatsappSubscription = (id?: string) => api.delete<any>(`/workspace/webhooks/${id}`);

// Quick Replies
export interface QuickReply { id: string; [key: string]: any; }
export const getQuickReplies = () => api.get<any>('/workspace/quick-replies').then(res => unwrapData<QuickReply[]>(res));
export const saveQuickReply = (data: any) => api.post<any>('/workspace/quick-replies', data);
export const deleteQuickReply = (id: string) => api.delete<any>(`/workspace/quick-replies/${id}`);

// Inbox Settings
export const getInboxSettings = () => api.get<any>('/workspace/inbox-settings').then(unwrapData);
export const updateInboxSettings = (data: any) =>
  api.patch<any>('/workspace/inbox-settings', data).then(unwrapData);

export const searchTeamMembers = (email: string) =>
  api.get<any>(`/workspace/team/search`, { params: { email } });
