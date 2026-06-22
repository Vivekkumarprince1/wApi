import api, { unwrapData } from './client';

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
  reminders?: Array<{ timestamp: string; method: string }>;
}

export const fetchPipelines = () => api.get('/crm/pipelines').then(unwrapData);
export const createPipeline = (data: any) => api.post('/crm/pipelines', data).then(unwrapData);
export const fetchCrmAnalytics = (params?: any) => api.get('/crm/analytics', { params }).then(unwrapData);
export const fetchTasks = (params?: any) => api.get('/crm/tasks', { params }).then(unwrapData);
export const updateTaskStatus = (id: string, status: string) => api.patch(`/crm/tasks/${id}/status`, { status }).then(unwrapData);
export const deleteTask = (id: string) => api.delete(`/crm/tasks/${id}`).then(unwrapData);
export const createTask = (data: any) => api.post('/crm/tasks', data).then(unwrapData);
export const updateTask = (id: string, data: any) => api.patch(`/crm/tasks/${id}`, data).then(unwrapData);

export const createDeal = (data: any) => api.post('/crm/deals', data).then(unwrapData);
export const updateDeal = (id: string, data: any) => api.patch(`/crm/deals/${id}`, data).then(unwrapData);
export const fetchDeals = (params?: { pipelineId?: string }) => api.get('/crm/deals', { params }).then(unwrapData);
export const fetchDealById = (id: string) => api.get(`/crm/deals/${id}`).then(unwrapData);
export const deleteDeal = (id: string) => api.delete(`/crm/deals/${id}`).then(unwrapData);
export const updateDealStage = (id: string, stageId: string) => api.patch(`/crm/deals/${id}/stage`, { stageId }).then(unwrapData);
export const fetchContactDeals = (contactId: string) => api.get(`/crm/contacts/${contactId}/deals`).then(unwrapData);
export const addDealNote = (id: string, text: string) => api.post(`/crm/deals/${id}/notes`, { text }).then(unwrapData);
export const fetchPipelineAutomation = (pipelineId: string) =>
  api.get('/crm/automation', { params: { pipelineId } }).then(unwrapData);
export const savePipelineAutomationRule = (pipelineId: string, rule: any) =>
  api.post('/crm/automation', { ...rule, config: { ...rule.config, pipelineId } });
export const deletePipelineAutomationRule = (id: string) =>
  api.delete('/crm/automation', { params: { id } });
