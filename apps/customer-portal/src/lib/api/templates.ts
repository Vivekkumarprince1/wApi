import api from './client';

export interface Template {
  _id: string;
  id?: string;
  name: string;
  category: string;
  language: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'DRAFT' | 'DELETED' | 'FAILED' | 'IN_APPEAL';
  templateType?: 'STANDARD' | 'CAROUSEL' | 'LTO';
  bodyText?: string;
  body?: { text: string };
  header?: { format: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'; text?: string; enabled?: boolean };
  buttons?: { items: any[] };
  qualityScore?: { score: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN' };
  updatedAt: string;
  createdAt: string;
}

export const fetchTemplates = (params?: any) => api.get('/templates', { params });
export const fetchTemplateCategories = () => api.get('/templates/categories');
export const fetchTemplateById = (id: string) => api.get(`/templates/${id}`);
export const createTemplate = (data: any) => api.post('/templates', data);
export const deleteTemplate = (id: string) => api.delete(`/templates/${id}`);
export const syncTemplates = () => api.post('/templates/sync');
export const updateTemplate = (id: string, data: any) => api.patch(`/templates/${id}`, data);
export const submitTemplateToMeta = (id: string) => api.post(`/templates/${id}/submit`);
export interface TemplateRule { _id: string; [key: string]: any; }
export interface TemplateRuleFormPayload { [key: string]: any; }
export interface TemplateRuleSummaryStats { [key: string]: any; }

export const TRIGGER_TYPES = [
  { value: 'message_keyword', label: 'Message Keyword' },
  { value: 'new_conversation', label: 'New Conversation' },
  { value: 'incoming_message', label: 'Incoming Message' },
  { value: 'status_update', label: 'Status Update' },
];

export const MATCH_MODES = [
  { value: 'contains', label: 'Contains' },
  { value: 'equals', label: 'Exact Match' },
  { value: 'starts_with', label: 'Starts With' },
  { value: 'ends_with', label: 'Ends With' },
  { value: 'regex', label: 'Regex Pattern' },
];

export type TemplateRuleTriggerType = 'message_keyword' | 'new_conversation' | 'incoming_message' | 'status_update';
export type TemplateRuleMatchMode = 'contains' | 'equals' | 'starts_with' | 'ends_with' | 'regex';

export interface TemplateRuleFormData {
  name: string;
  description: string;
  triggerType: TemplateRuleTriggerType;
  keywords: string[];
  matchMode: TemplateRuleMatchMode;
  template: string;
  conditions: {
    conversationStatus: string;
    timeWindow: { startTime: string; endTime: string; timezone: string };
    country: string;
    requiresTags: string[];
  };
  rateLimit: {
    enabled: boolean;
    window: number;
    maxTriggers: number;
  };
  priority: number;
  enabled: boolean;
}
export const fetchTemplateRules = (params?: any) => api.get('/templates/rules', { params });
export const createTemplateRule = (data: any) => api.post('/templates/rules', data);
export const updateTemplateRule = (id: string, data: any) => api.patch(`/templates/rules/${id}`, data);
export const deleteTemplateRule = (id: string) => api.delete(`/templates/rules/${id}`);
export const toggleTemplateRule = (id: string, active: boolean) => api.patch(`/templates/rules/${id}/toggle`, { active });
export const testTemplateRule = (id: string, data: any) => api.post(`/templates/rules/${id}/test`, data);
export const getRuleStats = (id: string) => api.get(`/templates/rules/${id}/stats`);

// analytics
export const getWorkspaceAnalytics = (params?: any) => api.get('/templates/analytics/workspace', { params });
export const getTopPerformingTemplates = (limit?: number) => api.get('/templates/analytics/top', { params: { limit } });
export const getLowPerformingTemplates = (limit?: number) => api.get('/templates/analytics/low', { params: { limit } });
export const getTemplateBehavioralInsights = (params?: any) => api.get('/templates/analytics/behavioral', { params });
export const exportAnalyticsReport = (format: string) => api.post('/templates/analytics/export', { format });

export const fetchTemplatesByChannel = (channel: string, limit: number) =>
  api.get<any>('/templates', { params: { channel, limit } });

