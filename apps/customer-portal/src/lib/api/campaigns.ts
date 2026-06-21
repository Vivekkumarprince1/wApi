import api from './client';

export interface Campaign {
  _id: string;
  name: string;
  description?: string;
  status: 'draft' | 'sending' | 'paused' | 'completed' | 'failed' | 'scheduled' | 'queued';
  campaignType: 'one-time' | 'scheduled';
  template?: {
    _id: string;
    name: string;
  };
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  totalContacts: number;
  createdAt: string;
  updatedAt: string;
  scheduledAt?: string;
}

export const fetchCampaigns = (params?: any) => api.get<any>('/campaign/campaigns', { params });
export const fetchCampaignById = (id: string) => api.get(`/campaign/campaigns/${id}`);
export const createCampaign = (data: any) => api.post<any>('/campaign/campaigns/create', data);
export const updateCampaign = (id: string, data: any) => api.put(`/campaign/campaigns/${id}`, data);
export const deleteCampaign = (id: string) => api.delete(`/campaign/campaigns/${id}`);
export const performCampaignAction = (id: string, action: any) => api.post(`/campaign/campaigns/${id}/lifecycle`, { action });
export const retargetCampaign = (id: string, type: any) => api.post(`/campaign/campaigns/${id}/retarget`, { type });
export const fetchCampaignMessages = (campaignId: string, params?: any) =>
  api.get<any>(`/campaigns/${campaignId}/messages`, { params });

// Segments
export const fetchSegments = () => api.get('/campaign/segments');
export const fetchSegmentById = (id: string) => api.get(`/campaign/segments/${id}`);
export const createSegment = (data: any) => api.post('/campaign/segments', data);
export const updateSegment = (id: string, data: any) => api.put(`/campaign/segments/${id}`, data);
export const deleteSegment = (id: string) => api.delete(`/campaign/segments/${id}`);

export const getCampaignExportUrl = (campaignId: string) =>
  `/api/v1/campaigns/${campaignId}/export`;
