import { get, post, put, del, getAuthHeaders, API_URL } from './client';

export const fetchContacts = async (page = 1, limit = 50, search = '') => {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    ...(search && { search })
  });
  return get(`/contacts?${params}`);
};

export const uploadContacts = async (contacts) => {
  return post('/contacts/upload', { contacts });
};

export const getContactStats = async () => {
  return get('/contacts/stats');
};

export const deleteContact = async (contactId) => {
  return del(`/contacts/${contactId}`);
};

export const getContact = async (contactId) => {
  return get(`/contacts/${contactId}`);
};

export const updateContact = async (contactId, data) => {
  return put(`/contacts/${contactId}`, data);
};

export const getContactSettings = async () => {
  return get('/contact-settings');
};

export const updateContactSettings = async (data) => {
  return put('/contact-settings', data);
};

export const getContactEvents = async (contactId, limit = 50) => {
  return get(`/contact-settings/${contactId}/events?limit=${limit}`);
};

export const logContactEvent = async (contactId, data) => {
  return post(`/contact-settings/${contactId}/events`, data);
};
