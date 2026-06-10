import api from './client';

// `apiClient` already strips `response.data` in its response interceptor.
// Tickets
export const getTickets = () => api.get('/support/tickets');
export const createTicket = (data: any) => api.post('/support/tickets', data);
export const updateTicket = (id: string, data: any) => api.put(`/support/tickets/${id}`, data);

// Macros
export const getMacros = () => api.get('/support/macros');
export const createMacro = (data: any) => api.post('/support/macros', data);
export const updateMacro = (id: string, data: any) => api.patch(`/support/macros/${id}`, data);
export const deleteMacro = (id: string) => api.delete(`/support/macros/${id}`);
