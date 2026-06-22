import api, { unwrapData } from './client';

export interface AutomationRule {
  _id: string;
  name: string;
  category: 'auto_reply' | 'workflow' | 'system';
  enabled: boolean;
  [key: string]: any;
}

export interface AnswerBotSettings {
  enabled: boolean;
  personaName: string;
  aiModel: string;
  systemPrompt: string;
  fallbackAction: string;
  fallbackMessage: string;
  confidenceThreshold?: number;
}

export interface AnswerBotSource {
  _id: string;
  sourceType: 'url' | 'text' | 'document';
  title?: string;
  websiteUrl?: string;
  textContent?: string;
  crawlStatus: 'pending' | 'in_progress' | 'completed' | 'failed';
  faqCount: number;
  createdAt: string;
}

export interface FAQ {
  _id: string;
  question: string;
  answer: string;
  source?: 'answerbot' | 'manual';
  matchCount?: number;
  interactive?: {
    buttons: Array<{ id: string; title: string }>;
  };
  status: 'draft' | 'approved';
}

export interface WhatsAppForm {
  _id: string;
  name: string;
  description?: string;
  status: 'draft' | 'published';
  flowType?: 'static' | 'dynamic';
  flowId?: string;
  flowVersion?: string;
  category?: string;
  screens?: any[];
  statistics?: {
    totalResponses: number;
    completedResponses: number;
    abandonedResponses: number;
    totalStarts: number;
    completionRate: number;
    lastResponseAt?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface InteraktiveList {
  _id: string;
  name: string;
  description?: string;
  enabled: boolean;
  triggerKeywords?: string[];
  message: {
    header?: string;
    body: string;
    footer?: string;
    buttonText: string;
    sections: Array<{
      title: string;
      rows: Array<{
        id: string;
        title: string;
        description?: string;
      }>;
    }>;
  };
  createdAt: string;
  updatedAt: string;
}

export const fetchRules = (category?: string) => api.get('/automation/engine/rules', { params: { category } }).then(unwrapData);
export const createRule = (data: any) => api.post('/automation/engine/rules', data).then(unwrapData);
export const updateRule = (id: string, data: any) => api.put(`/automation/engine/rules/${id}`, data).then(unwrapData);
export const toggleRule = (id: string, enabled: boolean) => api.patch(`/automation/engine/rules/${id}/toggle`, { enabled }).then(unwrapData);
export const deleteRule = (id: string) => api.delete(`/automation/engine/rules/${id}`).then(unwrapData);
export const getRuleById = (id: string) => api.get(`/automation/engine/rules/${id}`).then(unwrapData);

export const getAnswerBotSettings = (workspaceId?: string) => api.get('/automation/engine/answerbot/settings', { params: { workspaceId } }).then(unwrapData);
export const updateAnswerBotSettings = (workspaceId: string, data: any) => api.patch('/automation/engine/answerbot/settings', data, { params: { workspaceId } }).then(unwrapData);
export const getAnswerBotSources = (workspaceId?: string) => api.get('/automation/engine/answerbot/sources', { params: { workspaceId } }).then(unwrapData);
export const addAnswerBotSource = (workspaceId: string, data: any) => api.post('/automation/engine/answerbot/sources', data, { params: { workspaceId } }).then(unwrapData);
export const deleteAnswerBotSource = (workspaceId: string, sourceId: string) =>
  api.delete(`/automation/engine/answerbot/sources/${sourceId}`, { params: { workspaceId } });
export const getAnswerBotFAQs = (workspaceId?: string, params?: any) => api.get('/automation/engine/answerbot/faqs', { params: { ...params, workspaceId } }).then(unwrapData);
export const approveAnswerBotFAQs = (workspaceId: string, ids: string[]) => api.post('/automation/engine/answerbot/faqs/approve', { ids }, { params: { workspaceId } }).then(unwrapData);
export const createAnswerBotFAQ = (workspaceId: string, data: { question: string; answer: string; interactive?: any }) => api.post('/automation/engine/answerbot/faqs', data, { params: { workspaceId } }).then(unwrapData);
export const generateAnswerBotFAQs = (workspaceId: string, data: any) => api.post('/automation/engine/answerbot/faqs/generate', data, { params: { workspaceId } }).then(unwrapData);
export const updateAnswerBotFAQ = (workspaceId: string, faqId: string, data: any) =>
  api.patch(`/automation/engine/answerbot/faqs/${faqId}`, data, { params: { workspaceId } }).then(unwrapData);

export const fetchAiIntents = (params?: any) => api.get('/automation/engine/ai-intent', { params }).then(unwrapData);
export const createAiIntent = (data: any) => api.post('/automation/engine/ai-intent', data).then(unwrapData);

export const getAutomationStats = (params?: { ruleId?: string; days?: number }) => api.get('/automation/engine/stats', { params }).then(unwrapData);
export const getAutomationLogs = (params?: { ruleId?: string; status?: string; page?: number; limit?: number }) => api.get('/automation/engine/logs', { params }).then(unwrapData);

export const fetchInstagramQuickflows = (params?: any) => api.get('/automation/engine/instagram-quickflows', { params }).then(unwrapData);
export const getInstagramQuickflow = (id: string) => api.get(`/automation/engine/instagram-quickflows/${id}`).then(unwrapData);
export const createInstagramQuickflow = (data: any) => api.post('/automation/engine/instagram-quickflows', data).then(unwrapData);
export const updateInstagramQuickflow = (id: string, data: any) => api.patch(`/automation/engine/instagram-quickflows/${id}`, data).then(unwrapData);
export const toggleInstagramQuickflow = (id: string) => api.patch(`/automation/engine/instagram-quickflows/${id}/toggle`).then(unwrapData);
export const deleteInstagramQuickflow = (id: string) => api.delete(`/automation/engine/instagram-quickflows/${id}`).then(unwrapData);

export const fetchInteraktiveLists = (params?: any) => api.get('/automation/engine/interaktive-list', { params }).then(unwrapData);
export const createInteraktiveList = (data: any) => api.post('/automation/engine/interaktive-list', data).then(unwrapData);
export const updateInteraktiveList = (id: string, data: any) => api.put(`/automation/engine/interaktive-list/${id}`, data).then(unwrapData);
export const toggleInteraktiveList = (id: string, enabled: boolean) => api.patch(`/automation/engine/interaktive-list/${id}`, { enabled }).then(unwrapData);
export const deleteInteraktiveList = (id: string) => api.delete(`/automation/engine/interaktive-list/${id}`).then(unwrapData);

export const fetchWhatsAppForms = (params?: any) => api.get('/automation/engine/whatsapp-forms', { params }).then(unwrapData);
export const getWhatsAppForm = (id: string) => api.get(`/automation/engine/whatsapp-forms/${id}`).then(unwrapData);
export const createWhatsAppForm = (data: any) => api.post('/automation/engine/whatsapp-forms', data).then(unwrapData);
export const updateWhatsAppForm = (id: string, data: any) => api.put(`/automation/engine/whatsapp-forms/${id}`, data).then(unwrapData);
export const deleteWhatsAppForm = (id: string) => api.delete(`/automation/engine/whatsapp-forms/${id}`).then(unwrapData);
export const publishWhatsAppForm = (id: string) => api.post(`/automation/engine/whatsapp-forms/${id}/publish`).then(unwrapData);
export const unpublishWhatsAppForm = (id: string) => api.post(`/automation/engine/whatsapp-forms/${id}/unpublish`).then(unwrapData);
export const syncWhatsAppForm = (id: string) => api.post(`/automation/engine/whatsapp-forms/${id}/sync`).then(unwrapData);

export const fetchAutomationHubSummary = (params?: { days?: number }) => api.get('/automation/engine/hub/summary', { params }).then(unwrapData);
export const fetchWhatsAppFormResponses = (id: string, params?: any) => api.get(`/automation/engine/whatsapp-forms/${id}/responses`, { params }).then(unwrapData);

export const executeRule = (ruleId: string, payload?: any) =>
  api.post<any>(`/automation/engine/rules/${ruleId}/execute`, payload).then(unwrapData);

export const getWhatsAppFormResponsesExportUrl = (formId: string, status: string) =>
  `/api/v1/automation/engine/whatsapp-forms/${formId}/responses?status=${status}&format=csv`;

export const exportWhatsAppFormResponses = async (formId: string, status: string) => {
  const response = await fetch(getWhatsAppFormResponsesExportUrl(formId, status), {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to export responses');
  }
  return response.blob();
};
