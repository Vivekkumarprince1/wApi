import api from './client';

export const getWidgetConfig = () => api.get('/widget/config').then((res: any) => res.data || res);
export const updateWidgetConfig = (data: any) => api.post('/widget/config', data);
