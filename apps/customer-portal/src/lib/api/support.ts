import api, { unwrapData } from './client';

// `apiClient` already strips `response.data` in its response interceptor.
// Tickets
export const getTickets = () => api.get('/support/tickets').then(unwrapData);
export const createTicket = (data: any) => api.post('/support/tickets', data).then(unwrapData);
export const updateTicket = (id: string, data: any) => api.put(`/support/tickets/${id}`, data).then(unwrapData);

// Macros
export const getMacros = () => api.get('/support/macros').then(unwrapData);
export const createMacro = (data: any) => api.post('/support/macros', data).then(unwrapData);
export const updateMacro = (id: string, data: any) => api.patch(`/support/macros/${id}`, data).then(unwrapData);
export const deleteMacro = (id: string) => api.delete(`/support/macros/${id}`).then(unwrapData);
