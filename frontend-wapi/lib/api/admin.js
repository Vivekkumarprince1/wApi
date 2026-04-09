import { get, post, put, patch } from './client';

// Helper to filter params and build query string
const buildQuery = (params) => {
  const filtered = Object.fromEntries(
    Object.entries(params).filter(([_, v]) => 
      v != null && v !== '' && v !== 'undefined' && v !== undefined
    )
  );
  const query = new URLSearchParams(filtered).toString();
  return query ? `?${query}` : '';
};

// Dashboard Overview
export const getAdminAnalytics = (params = {}) => {
  return get(`/admin/analytics${buildQuery(params)}`);
};

// Workspaces
export const getAllWorkspaces = (params = {}) => {
  return get(`/admin/workspaces${buildQuery(params)}`);
};

export const getWorkspaceDetails = (workspaceId) => get(`/admin/workspaces/${workspaceId}`);

export const suspendWorkspace = (workspaceId, reason) => post(`/admin/workspaces/${workspaceId}/suspend`, { reason });

export const resumeWorkspace = (workspaceId) => post(`/admin/workspaces/${workspaceId}/resume`);

export const updateWorkspacePlan = (workspaceId, planId) => patch(`/admin/workspaces/${workspaceId}/plan`, { planId });

// Users
export const getAllUsers = (params = {}) => {
  return get(`/admin/users${buildQuery(params)}`);
};

export const updateUserRole = (userId, data) => patch(`/admin/users/${userId}/role`, data);

// WhatsApp Setup
export const getWhatsAppSetupRequests = (status) => {
  const query = status ? `?status=${status}` : '';
  return get(`/admin/whatsapp-setup-requests${query}`);
};

export const updateWhatsAppSetupStatus = (workspaceId, data) => put(`/admin/whatsapp-setup-requests/${workspaceId}`, data);
