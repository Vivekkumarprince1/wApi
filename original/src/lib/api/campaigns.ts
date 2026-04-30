import api from '@/lib/axios';

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

export const fetchCampaigns = async (params: any = {}): Promise<any> => {
  return await api.get("/campaign-proxy/campaigns", { params });
};

export const fetchCampaignById = async (id: string) => {
  const response = await api.get(`/campaign-proxy/campaigns/${id}`);
  return response;
};

export const createCampaign = async (data: any): Promise<any> => {
  const response = await api.post('/campaign-proxy/campaigns/create', data);
  return response;
};

export const updateCampaign = async (id: string, data: any): Promise<any> => {
  const response = await api.put(`/campaign-proxy/campaigns/${id}`, data);
  return response;
};

export const deleteCampaign = async (id: string): Promise<any> => {
  const response = await api.delete(`/campaign-proxy/campaigns/${id}`);
  return response;
};

export const performCampaignAction = async (id: string, action: any): Promise<any> => {
  return await api.post(`/campaign-proxy/campaigns/${id}/lifecycle`, { action });
};

export const retargetCampaign = async (id: string, type: any): Promise<any> => {
  return await api.post(`/campaign-proxy/campaigns/${id}/retarget`, { type });
};
