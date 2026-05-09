import api from './client';

// `apiClient` already strips `response.data`.
export const getWidgetConfig = () => api.get('/widget/config');
export const updateWidgetConfig = (data: any) => api.post('/widget/config', data);
