import api from './client';

export const getAds = () => api.get('/ads').then((res: any) => res.data || res);
export const createAd = (data: any) => api.post('/ads', data);
export const updateAd = (id: string, data: any) => api.put(`/ads/${id}`, data);
export const deleteAd = (id: string) => api.delete(`/ads/${id}`);
