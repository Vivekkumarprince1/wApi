import api from './client';

// `apiClient` already strips `response.data` in its response interceptor,
// so `api.get(...)` returns the body directly. Removing the legacy
// `.then(res => res.data || res)` unwrap, which double-unwrapped one shape
// and not the other.
export const getAds = () => api.get<any[]>('/ads');
export const createAd = (data: any) => api.post('/ads', data);
export const updateAd = (id: string, data: any) => api.put(`/ads/${id}`, data);
export const deleteAd = (id: string) => api.delete(`/ads/${id}`);
