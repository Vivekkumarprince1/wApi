import api from './client';

/** Axios interceptor already returns JSON body; many routes wrap payloads in `{ data }`. */
function unwrapData<T>(res: any): T {
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
export const getWhatsappProfile = () => api.get('/workspace/profile').then(unwrapData);
export const updateWhatsappProfile = (data: any) => api.patch('/workspace/profile', data);
export const syncWhatsappProfile = () => api.post('/workspace/profile/sync');
export const updateWhatsappDisplayName = (name: string) => api.patch('/workspace/profile/display-name', { name });

// Tags
export const getTags = () => api.get('/workspace/tags').then(unwrapData);
export const createTag = (data: any) => api.post('/workspace/tags', data);
export const deleteTag = (id: string) => api.delete(`/workspace/tags/${id}`);

// Developer Settings
export const getDeveloperSettings = () => api.get('/workspace/developer').then(unwrapData);
export const updateDeveloperSettings = (data: any) => api.patch('/workspace/developer', data);

// Roles & Permissions
export const getRoles = () => api.get('/workspace/roles').then(unwrapData);
export const createRole = (data: any) => api.post('/workspace/roles', data);
export const updateRole = (id: string, data: any) => api.patch(`/workspace/roles/${id}`, data);
export const deleteRole = (id: string) => api.delete(`/workspace/roles/${id}`);
export const getPermissionsMatrix = () => api.get('/workspace/roles/matrix').then(unwrapData);

// Teams
export const getTeams = () => api.get('/workspace/teams').then(unwrapData);
export const createTeam = (data: any) => api.post('/workspace/teams', data);
export const updateTeam = (id: string, data: any) => api.patch(`/workspace/teams/${id}`, data);
export const deleteTeam = (id: string) => api.delete(`/workspace/teams/${id}`);

// Members
export const getTeamMembers = () => api.get('/workspace/members').then(unwrapData);
export const inviteTeamMember = (data: any) => api.post('/workspace/members/invite', data);
export const updateMember = (id: string, data: any) => api.patch(`/workspace/members/${id}`, data);
export const updateMemberRole = (id: string, role: string) => api.patch(`/workspace/members/${id}/role`, { role });
export const deleteMember = (id: string) => api.delete(`/workspace/members/${id}`);
export const getMemberPermissions = (memberId: string) =>
  api.get(`/workspace/members/${memberId}/permissions`).then(unwrapData);
export const updateMemberPermissions = (memberId: string, permissions: any) =>
  api.patch(`/workspace/members/${memberId}/permissions`, { permissions });

// WABA Settings
export interface WABASettings { id?: string; [key: string]: any; }
export const getWABASettings = () =>
  api.get('/workspace/waba').then((res: any) => res.waba || unwrapData(res));
export const updateWABASettings = (data: any) => api.patch('/workspace/waba', data);
export const testWABAConnection = () => api.post('/workspace/waba/test');

// Webhooks
export const getWhatsappSubscriptions = () => api.get('/workspace/webhooks').then(unwrapData);
export const createWhatsappSubscription = (data: any) => api.post('/workspace/webhooks', data);
export const updateWhatsappSubscription = (id: string | any, data?: any) => {
  if (typeof id === 'object' && !data) {
    return api.patch(`/workspace/webhooks/${id.subscriptionId}`, id);
  }
  return api.patch(`/workspace/webhooks/${id}`, data);
};
export const deleteWhatsappSubscription = (id?: string) => api.delete(`/workspace/webhooks/${id}`);

// Quick Replies
export interface QuickReply { id: string; [key: string]: any; }
export const getQuickReplies = () => api.get('/workspace/quick-replies').then(unwrapData);
export const saveQuickReply = (data: any) => api.post('/workspace/quick-replies', data);
export const deleteQuickReply = (id: string) => api.delete(`/workspace/quick-replies/${id}`);

// Inbox Settings
export const getInboxSettings = () => api.get('/workspace/inbox-settings').then(unwrapData);
export const updateInboxSettings = (data: any) =>
  api.patch('/workspace/inbox-settings', data).then(unwrapData);
