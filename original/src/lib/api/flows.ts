import axios from 'axios';

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
  const { data } = await axios.get('/api/flows');
  return data.flows;
};

export const createFlow = async (name: string, categories: string[]): Promise<WhatsAppFlow> => {
  const { data } = await axios.post('/api/flows', { name, categories });
  return data.flow;
};

export const getFlowDetails = async (flowId: string): Promise<{ flow: WhatsAppFlow, flowJson: any, bspDetails: any }> => {
  const { data } = await axios.get(`/api/flows/${flowId}`);
  return data;
};

export const deleteFlow = async (flowId: string): Promise<void> => {
  await axios.delete(`/api/flows/${flowId}`);
};

export const updateFlowJson = async (flowId: string, name: string, json: any): Promise<any> => {
  const { data } = await axios.post(`/api/flows/${flowId}/action`, {
    action: 'updateJson',
    name,
    json
  });
  return data;
};

export const updateFlowCategories = async (flowId: string, categories: string[]): Promise<WhatsAppFlow> => {
  const { data } = await axios.post(`/api/flows/${flowId}/action`, {
    action: 'updateCategories',
    categories
  });
  return data.flow;
};

export const getFlowPreviewUrl = async (flowId: string): Promise<WhatsAppFlow> => {
  const { data } = await axios.post(`/api/flows/${flowId}/action`, {
    action: 'preview'
  });
  return data.flow;
};

export const publishFlow = async (flowId: string): Promise<WhatsAppFlow> => {
  const { data } = await axios.post(`/api/flows/${flowId}/action`, {
    action: 'publish'
  });
  return data.flow;
};

export const deprecateFlow = async (flowId: string): Promise<WhatsAppFlow> => {
  const { data } = await axios.post(`/api/flows/${flowId}/action`, {
    action: 'deprecate'
  });
  return data.flow;
};
