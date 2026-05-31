import api from './client';

// `apiClient` already strips `response.data` in its response interceptor,
// so `api.get(...)` returns the body directly. Removing the legacy
// `.then(res => res.data || res)` unwrap, which double-unwrapped one shape
// and not the other.
export const getAds = () => api.get<any[]>('/v1/ads').then((res: any) => res.data || res);
export const createAd = (data: any) => api.post('/v1/ads', data);
export const updateAd = (id: string, data: any) => api.put(`/v1/ads/${id}`, data);
export const deleteAd = (id: string) => api.delete(`/v1/ads/${id}`);
