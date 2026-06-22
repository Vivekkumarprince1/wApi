import api, { unwrapData } from './client';

// Supports both raw arrays and wrapped `{ data: [...] }` API responses.
export const getAds = () => api.get<any[]>('/ads').then(unwrapData<any[]>);
export const createAd = (data: any) => api.post('/ads', data).then(unwrapData);
export const updateAd = (id: string, data: any) => api.put(`/ads/${id}`, data).then(unwrapData);
export const deleteAd = (id: string) => api.delete(`/ads/${id}`).then(unwrapData);
