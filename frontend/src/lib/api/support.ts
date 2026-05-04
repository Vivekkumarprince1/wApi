import api from './client';

// Tickets
export const getTickets = () => api.get('/support/tickets').then((res: any) => res.data || res);
export const createTicket = (data: any) => api.post('/support/tickets', data);
export const updateTicket = (id: string, data: any) => api.put(`/support/tickets/${id}`, data);

// Macros
export const getMacros = () => api.get('/support/macros').then((res: any) => res.data || res);
export const createMacro = (data: any) => api.post('/support/macros', data);
export const updateMacro = (id: string, data: any) => api.patch(`/support/macros/${id}`, data);
export const deleteMacro = (id: string) => api.delete(`/support/macros/${id}`);
