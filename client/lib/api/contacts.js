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
