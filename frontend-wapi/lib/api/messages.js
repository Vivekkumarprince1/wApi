import { post, get, put, API_URL } from './client';

export const sendTemplateMessage = async (data) => post('/messages/template', data);

export const sendBulkTemplateMessage = async (data) => post('/messages/bulk-template', data);

export const fetchConversations = async (params = {}) => {
  const queryParams = new URLSearchParams(params);
  return get(`/conversations?${queryParams}`);
};

export const fetchConversationByContact = async (contactId) => get(`/conversations/${contactId}`);

export const fetchMessageThread = async (contactId, params = {}) => {
  const queryParams = new URLSearchParams(params);
  return get(`/conversations/${contactId}/messages?${queryParams}`);
};

export const updateConversation = async (contactId, updates) => put(`/conversations/${contactId}`, updates);

export const markConversationAsRead = async (contactId) => post(`/conversations/${contactId}/read`, {});

export const getInboxSettings = async () => get('/settings/inbox');

export const updateInboxSettings = async (settings) => put('/settings/inbox', settings);

export const fetchAvailableAgents = async () => get('/admin/team/members');

// Internal Notes
export const getConversationNotes = async (conversationId) => get(`/inbox/${conversationId}/notes`);

export const uploadInboxMedia = async (file) => {
  const token = localStorage.getItem('token');
  const formData = new FormData();
  formData.append('file', file);
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const response = await fetch(`${API_URL}/inbox/upload-media`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: formData
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to upload media');
  }
  return await response.json();
};
export const createConversationNote = async (conversationId, content) => post(`/inbox/${conversationId}/notes`, { content });
export const updateConversationNote = async (conversationId, noteId, content) => put(`/inbox/${conversationId}/notes/${noteId}`, { content });
export const deleteConversationNote = async (conversationId, noteId) => del(`/inbox/${conversationId}/notes/${noteId}`);
export const searchConversationNotes = async (query) => get(`/inbox/notes/search?q=${query}`);
