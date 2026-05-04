import api from './client';

export interface WhatsAppFlow {
  _id: string;
  name: string;
  categories: string[];
  status: 'DRAFT' | 'PUBLISHED' | 'DEPRECATED';
  gupshupFlowId?: string;
  previewUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export const fetchFlows = async (): Promise<WhatsAppFlow[]> => {
  const res: any = await api.get('/flows');
  return res.data || [];
};

export const createFlow = async (name: string, categories: string[]): Promise<WhatsAppFlow> => {
  const res: any = await api.post('/flows', { name, categories });
  return res.data;
};

export const getFlowDetails = async (flowId: string): Promise<{ flow: WhatsAppFlow, flowJson: any, bspDetails: any }> => {
  const res: any = await api.get(`/flows/${flowId}`);
  return res.data;
};

export const deleteFlow = async (flowId: string): Promise<void> => {
  await api.delete(`/flows/${flowId}`);
};

export const updateFlowJson = async (flowId: string, name: string, json: any): Promise<any> => {
  const res: any = await api.post(`/flows/${flowId}/action`, {
    action: 'updateJson',
    name,
    json
  });
  return res.data;
};

export const updateFlowCategories = async (flowId: string, categories: string[]): Promise<WhatsAppFlow> => {
  const res: any = await api.post(`/flows/${flowId}/action`, {
    action: 'updateCategories',
    categories
  });
  return res.data?.flow || res.data;
};

export const getFlowPreviewUrl = async (flowId: string): Promise<WhatsAppFlow> => {
  const res: any = await api.post(`/flows/${flowId}/action`, {
    action: 'preview'
  });
  return res.data?.flow || res.data;
};

export const publishFlow = async (flowId: string): Promise<WhatsAppFlow> => {
  const res: any = await api.post(`/flows/${flowId}/action`, {
    action: 'publish'
  });
  return res.data?.flow || res.data;
};

export const deprecateFlow = async (flowId: string): Promise<WhatsAppFlow> => {
  const res: any = await api.post(`/flows/${flowId}/action`, {
    action: 'deprecate'
  });
  return res.data?.flow || res.data;
};
