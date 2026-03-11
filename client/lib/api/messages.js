import { post, get, put } from './client';

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
export const getConversationNotes = async (conversationId) => get(`/conversations/${conversationId}/notes`);
export const createConversationNote = async (conversationId, content) => post(`/conversations/${conversationId}/notes`, { content });
export const updateConversationNote = async (conversationId, noteId, content) => put(`/conversations/${conversationId}/notes/${noteId}`, { content });
export const deleteConversationNote = async (conversationId, noteId) => del(`/conversations/${conversationId}/notes/${noteId}`);
export const searchConversationNotes = async (query) => get(`/conversations/notes/search?q=${query}`);
