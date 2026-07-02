import api, { unwrapData } from './client';

// Supports both raw arrays and wrapped `{ data: [...] }` API responses.
export const getAds = () => api.get<any[]>('/ads').then(unwrapData<any[]>);
export const createAd = (data: any) => api.post('/ads', data).then(unwrapData);
export const updateAd = (id: string, data: any) => api.put(`/ads/${id}`, data).then(unwrapData);
export const deleteAd = (id: string) => api.delete(`/ads/${id}`).then(unwrapData);
export const getMetaAdsReadiness = () => api.get<any>('/ads/meta/readiness');
export const publishAd = (id: string, desiredStatus: 'PAUSED' | 'ACTIVE' = 'PAUSED') =>
  api.post(`/ads/${id}/publish`, { desiredStatus }).then(unwrapData);
export const updateAdStatus = (id: string, status: 'PAUSED' | 'ACTIVE', reason?: string) =>
  api.post(`/ads/${id}/status`, { status, reason }).then(unwrapData);
export const syncAd = (id: string, params?: { since?: string; until?: string }) =>
  api.post(`/ads/${id}/sync`, undefined, { params }).then(unwrapData);
export const getAdPreview = (id: string, adFormat = 'DESKTOP_FEED_STANDARD') =>
  api.get<any>(`/ads/${id}/preview`, { params: { adFormat } }).then(unwrapData);
export const syncAllAds = (params?: { since?: string; until?: string }) =>
  api.post('/ads/meta/sync-all', undefined, { params }).then(unwrapData);
