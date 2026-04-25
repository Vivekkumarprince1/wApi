import api from '@/lib/axios';

export interface WABASettings {
  isConnected: boolean;
  hasToken: boolean;
  whatsappAccessToken?: string;
  whatsappPhoneNumberId?: string;
  phoneNumberId?: string;
  whatsappVerifyToken?: string;
  wabaId?: string;
  businessAccountId?: string;
  connectedAt?: string;
  maskedToken?: string;
  phoneNumber?: string;
  displayPhoneNumber?: string;
  status?: string;
  bspManaged?: boolean;
  onboarding?: any;
}

export interface TeamMember {
  _id: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'invited' | 'disabled';
  lastSeen?: string;
}

export interface QuickReply {
  _id: string;
  shortcut: string;
  message: string;
  category?: string;
}

// WABA Settings
export const getWABASettings = async () => {
  const response = await api.get('/workspace/settings/waba');
  return response;
};

export const updateWABASettings = async (data: any) => {
  const response = await api.patch('/workspace/settings/waba', data);
  return response;
};

export const testWABAConnection = async () => {
  const response = await api.post('/workspace/settings/waba/test');
  return response;
};

// Developer API
export const getDeveloperSettings = async () => {
  const response = await api.get('/developer/keys');
  return { apiKey: response.data?.[0]?.key || null };
};

export const rotateApiKey = async () => {
  const response = await api.post('/developer/keys', { name: "Rotated API Key" });
  return { apiKey: response.data?.key };
};

// Team & User Management (Enriched for Parity)
export const getTeamMembers = async () => {
  const response = await api.get('/workspace/team/members');
  return response.data?.data ?? response.data ?? { members: [], invitations: [] };
};

export const inviteTeamMember = async (data: { 
  email: string; 
  role: string; 
  name?: string;
  phone?: string;
  teamIds?: string[];
}) => {
  const response = await api.post('/workspace/team/members', data);
  return response.data?.data ?? response.data;
};

export const updateMember = async (memberId: string, data: {
  name?: string;
  phone?: string;
  role?: string;
  isActive?: boolean;
  resendEmail?: boolean;
  teamIds?: string[];
}) => {
  const response = await api.patch(`/workspace/team/members/${memberId}`, data);
  return response.data?.data ?? response.data;
};

export const updateMemberRole = async (memberId: string, role: string) => {
  const response = await api.patch(`/workspace/team/members/${memberId}`, { role });
  return response.data?.data ?? response.data;
};

export const deleteMember = async (memberId: string) => {
  const response = await api.delete(`/workspace/team/members/${memberId}`);
  return response.data?.data ?? response.data;
};

// Team Groups CRUD
export const getTeams = async () => {
  const response = await api.get('/workspace/team');
  return response.data?.data ?? response.data ?? [];
};

export const createTeam = async (data: any) => {
  const response = await api.post('/workspace/team', data);
  return response.data?.data ?? response.data;
};

export const updateTeam = async (id: string, data: any) => {
  const response = await api.put(`/workspace/team/${id}`, data);
  return response.data?.data ?? response.data;
};

export const deleteTeam = async (id: string) => {
  const response = await api.delete(`/workspace/team/${id}`);
  return response.data?.data ?? response.data;
};

// Permissions Matrix
export const getPermissionsMatrix = async () => {
  const response = await api.get('/workspace/team/permissions');
  return response.data?.data ?? response.data ?? null;
};

// Member Specific Permissions Overrides
export const getMemberPermissions = async (memberId: string) => {
  const response = await api.get(`/workspace/team/members/${memberId}/permissions`);
  return response.data;
};

export const updateMemberPermissions = async (memberId: string, data: any) => {
  const response = await api.patch(`/workspace/team/members/${memberId}/permissions`, data);
  return response.data;
};

// Role Management (Custom Roles)
export const getRoles = async () => {
  const response = await api.get('/workspace/team/roles');
  if (Array.isArray(response)) {
    return { data: response };
  }

  return response?.data ? response : { data: [] };
};

export const createRole = async (data: any) => {
  const response = await api.post('/workspace/team/roles', data);
  return response.data;
};

export const updateRole = async (id: string, data: any) => {
  const response = await api.patch(`/workspace/team/roles/${id}`, data);
  return response.data;
};

export const deleteRole = async (id: string) => {
  const response = await api.delete(`/workspace/team/roles/${id}`);
  return response.data;
};

// Quick Replies
export const getQuickReplies = async () => {
  const response = await api.get('/messaging/quick-replies');
  return response.data;
};

export const saveQuickReply = async (data: any) => {
  if (data._id) {
    const response = await api.patch(`/messaging/quick-replies/${data._id}`, data);
    return response.data;
  }
  const response = await api.post('/messaging/quick-replies', data);
  return response.data;
};

export const deleteQuickReply = async (id: string) => {
  const response = await api.delete(`/messaging/quick-replies/${id}`);
  return response.data;
};

// Tags
export const getTags = async () => {
  const response = await api.get('/workspace/settings/tags');
  return response.data;
};

export const createTag = async (data: any) => {
  const response = await api.post('/workspace/settings/tags', data);
  return response.data;
};

export const deleteTag = async (id: string) => {
  const response = await api.delete(`/workspace/settings/tags/${id}`);
  return response.data;
};

// WhatsApp Profile
export const getWhatsappProfile = async () => {
  const response = await api.get('/workspace/whatsapp/profile');
  return response;
};

export const updateWhatsappProfile = async (data: any) => {
  const response = await api.patch('/workspace/whatsapp/profile', data);
  return response;
};

export const updateWhatsappDisplayName = async (displayName: string) => {
  const response = await api.patch('/workspace/whatsapp/profile/display-name', { displayName });
  return response;
};

export const syncWhatsappProfile = async () => {
  const response = await api.post('/workspace/whatsapp/profile');
  return response;
};

// WhatsApp Webhook Subscriptions
export const getWhatsappSubscriptions = async () => {
  const response = await api.get('/workspace/whatsapp/subscriptions/status');
  return response;
};

export const createWhatsappSubscription = async (data: { events: string[] }) => {
  const response = await api.post('/workspace/whatsapp/subscriptions', data);
  return response;
};

export const updateWhatsappSubscription = async (data: { subscriptionId: string; events: string[]; tag?: string }) => {
  const response = await api.put('/workspace/whatsapp/subscriptions', data);
  return response;
};

export const deleteWhatsappSubscription = async (id?: string) => {
  const url = id ? `/workspace/whatsapp/subscriptions?id=${id}` : '/workspace/whatsapp/subscriptions';
  const response = await api.delete(url);
  return response;
};
