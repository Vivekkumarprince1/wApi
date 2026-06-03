import api from './client';

// `apiClient` already strips `response.data` in its response interceptor.
// Tickets
export const getTickets = () => api.get('/v1/support/tickets').then((res: any) => res.data || res);
export const createTicket = (data: any) => api.post('/v1/support/tickets', data);
export const updateTicket = (id: string, data: any) => api.put(`/v1/support/tickets/${id}`, data);

// Macros
export const getMacros = () => api.get('/v1/support/macros').then((res: any) => res.data || res);
export const createMacro = (data: any) => api.post('/v1/support/macros', data);
export const updateMacro = (id: string, data: any) => api.patch(`/v1/support/macros/${id}`, data);
export const deleteMacro = (id: string) => api.delete(`/v1/support/macros/${id}`);
