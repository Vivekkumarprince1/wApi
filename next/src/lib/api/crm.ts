import api from '@/lib/axios';

export interface DealNote {
  _id: string;
  text: string;
  author: {
    _id: string;
    name: string;
    avatar?: string;
  };
  createdAt: string;
}

export interface DealActivity {
  type: 'stage_change' | 'note_added' | 'assigned' | 'status_change' | 'attribute_update' | 'created';
  text: string;
  payload?: any;
  author: {
    _id: string;
    name: string;
  };
  timestamp: string;
  _id?: string;
}

export interface Deal {
  _id: string;
  title: string;
  contact: {
    _id: string;
    name: string;
    phone: string;
    avatar?: string;
  };
  pipeline: string | any;
  stage: string;
  value: number;
  currency: string;
  status: 'active' | 'won' | 'lost' | 'archived';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedAgent?: {
    _id: string;
    name: string;
    email: string;
  };
  notes: DealNote[];
  activityLog: DealActivity[];
  probability?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Pipeline {
  _id: string;
  name: string;
  stages: Array<{
    id: string;
    title: string;
    position: number;
    color?: string;
  }>;
}

export interface Task {
  _id: string;
  title: string;
  description?: string;
  type: 'Call' | 'WhatsApp' | 'Meeting' | 'Email' | 'Follow-up';
  dueDate?: string;
  priority: 'Low' | 'Medium' | 'High';
  status: 'Pending' | 'In Progress' | 'Completed';
  contact?: any;
  deal?: any;
  assignee?: any;
  reminders?: Array<{
    timestamp: string;
    sent: boolean;
  }>;
}

export const fetchDeals = async (params = {}) => {
  const response: any = await api.get('/crm/deals', { params });
  return response.data || response.deals || response;
};

export const fetchDealById = async (id: string) => {
  const response: any = await api.get(`/crm/deals/${id}`);
  return response.data || response.deal || response;
};

export const fetchContactDeals = async (contactId: string) => {
  const response: any = await api.get(`/crm/contacts/${contactId}/deals`);
  return response.data || response.deals || response;
};

export const createDeal = async (data: any) => {
  return await api.post('/crm/deals', data);
};

export const updateDeal = async (id: string, data: any) => {
  return await api.patch(`/crm/deals/${id}`, data);
};

export const updateDealStage = async (id: string, stage: string) => {
  return await api.patch(`/crm/deals/${id}/stage`, { stage });
};

export const deleteDeal = async (id: string) => {
  return await api.delete(`/crm/deals/${id}`);
};

export const addDealNote = async (id: string, text: string) => {
  return await api.post(`/crm/deals/${id}/notes`, { text });
};

export const fetchPipelines = async () => {
  const response: any = await api.get('/crm/pipelines');
  return response.data || response.pipelines || response;
};

export const fetchTasks = async (params = {}) => {
  const response: any = await api.get('/crm/tasks', { params });
  return response.data || response.tasks || response;
};

export const createTask = async (data: any) => {
  return await api.post('/crm/tasks', data);
};

export const updateTask = async (id: string, data: any) => {
  return await api.patch(`/crm/tasks/${id}`, data);
};

export const updateTaskStatus = async (id: string, status: string) => {
  return await api.patch(`/crm/tasks/${id}/status`, { status });
};

export const deleteTask = async (id: string) => {
  return await api.delete(`/crm/tasks/${id}`);
};
