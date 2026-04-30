import api from '@/lib/axios';

export interface AutomationRule {
  _id: string;
  name: string;
  category: 'auto_reply' | 'workflow' | 'system';
  enabled: boolean;
  trigger: {
    event: string;
    type?: string;
    filters: any;
  };
  actions: Array<{
    type: string;
    config: any;
  }>;
  conditions?: any[];
  stats?: {
    totalExecutions: number;
    lastExecutedAt: string;
  };
  createdAt: string;
  updatedAt: string;
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

export interface InteraktiveListRow {
  id: string;
  title: string;
  description?: string;
}

export interface InteraktiveListSection {
  title: string;
  rows: InteraktiveListRow[];
}

export interface InteraktiveList {
  _id: string;
  name: string;
  description?: string;
  enabled: boolean;
  triggerKeywords: string[];
  message: {
    header?: string;
    body: string;
    footer?: string;
    buttonText: string;
    sections: InteraktiveListSection[];
  };
  stats?: {
    sentCount?: number;
    lastSentAt?: string;
  };
  createdAt: string;
  updatedAt: string;
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
  rawFlowJson?: any;
  config?: {
    fallbackMessage?: string;
    sendConfirmationMessage?: boolean;
    confirmationText?: string;
  };
  statistics?: {
    totalResponses: number;
    completedResponses: number;
    abandonedResponses: number;
    totalStarts: number;
    completionRate: number;
    lastResponseAt?: string;
    averageTimeSpent?: number;
  };
  createdAt: string;
  updatedAt: string;
}

// Rules Engine API
export const fetchRules = async (category?: string) => {
  const params = category ? { category } : {};
  console.log(`[API] fetchRules called with category: ${category}`);
  const response = await api.get('/automation/engine/rules', { params });
  return response;
};

export const createRule = async (data: any) => {
  const response = await api.post('/automation/engine/rules', data);
  return response;
};

export const updateRule = async (id: string, data: any) => {
  const response = await api.put(`/automation/engine/rules/${id}`, data);
  return response;
};

export const toggleRule = async (id: string, enabled: boolean) => {
  const response = await api.patch(`/automation/engine/rules/${id}/toggle`, { enabled });
  return response;
};

export const deleteRule = async (id: string) => {
  const response = await api.delete(`/automation/engine/rules/${id}`);
  return response;
};

export const getRuleById = async (id: string) => {
  const response = await api.get(`/automation/engine/rules/${id}`);
  return response;
};

// AnswerBot API — sub-routes no longer embed workspaceId; auth middleware resolves workspace from session
export const getAnswerBotSettings = async (_workspaceId?: string) => {
  const response = await api.get('/automation/answerbot/settings');
  return response;
};

export const updateAnswerBotSettings = async (_workspaceId: string, data: any) => {
  const response = await api.patch('/automation/answerbot/settings', data);
  return response;
};

export const getAnswerBotSources = async (_workspaceId?: string) => {
  const response = await api.get('/automation/answerbot/sources');
  return response;
};

export const addAnswerBotSource = async (_workspaceId: string, data: any) => {
  const response = await api.post('/automation/answerbot/sources', data);
  return response;
};

export const getAnswerBotFAQs = async (_workspaceId?: string, params?: any) => {
  const response = await api.get('/automation/answerbot/faqs', { params });
  return response;
};

export const approveAnswerBotFAQs = async (_workspaceId: string, ids: string[]) => {
  const response = await api.post('/automation/answerbot/faqs/approve', { ids });
  return response;
};

export const createAnswerBotFAQ = async (_workspaceId: string, data: { question: string; answer: string; interactive?: any }) => {
  const response = await api.post('/automation/answerbot/faqs', data);
  return response;
};

export const generateAnswerBotFAQs = async (_workspaceId: string, data: any) => {
  const response = await api.post('/automation/answerbot/faqs/generate', data);
  return response;
};

// AI Intent Matching API
export const fetchAiIntents = async (params?: any) => {
  const response = await api.get('/automation/ai-intent', { params });
  return response;
};

export const createAiIntent = async (data: any) => {
  const response = await api.post('/automation/ai-intent', data);
  return response;
};

// Automation Engine — Stats, Logs, Test
export const getAutomationStats = async (params?: { ruleId?: string; days?: number }) => {
  const response = await api.get('/automation/engine/stats', { params });
  return response;
};

export const getAutomationLogs = async (params?: { ruleId?: string; status?: string; page?: number; limit?: number }) => {
  const response = await api.get('/automation/engine/logs', { params });
  return response;
};

export const testAutomationRule = async (data: { ruleId: string; conversationId: string; dryRun?: boolean }) => {
  const response = await api.post('/automation/engine/test', data);
  return response;
};

// Instagram QuickFlows API
export const fetchInstagramQuickflows = async (params?: any) => {
  const response = await api.get('/automation/instagram-quickflows', { params });
  return response;
};

export const createInstagramQuickflow = async (data: any) => {
  const response = await api.post('/automation/instagram-quickflows', data);
  return response;
};

export const toggleInstagramQuickflow = async (id: string) => {
  const response = await api.patch(`/automation/instagram-quickflows/${id}/toggle`);
  return response;
};

export const deleteInstagramQuickflow = async (id: string) => {
  const response = await api.delete(`/automation/instagram-quickflows/${id}`);
  return response;
};

// Interaktive List API
export const fetchInteraktiveLists = async (params?: { enabled?: boolean; search?: string }) => {
  const response = await api.get('/automation/interaktive-list', { params });
  return response;
};

export const createInteraktiveList = async (data: any) => {
  const response = await api.post('/automation/interaktive-list', data);
  return response;
};

export const updateInteraktiveList = async (id: string, data: any) => {
  const response = await api.put(`/automation/interaktive-list/${id}`, data);
  return response;
};

export const toggleInteraktiveList = async (id: string, enabled: boolean) => {
  const response = await api.patch(`/automation/interaktive-list/${id}`, { enabled });
  return response;
};

export const deleteInteraktiveList = async (id: string) => {
  const response = await api.delete(`/automation/interaktive-list/${id}`);
  return response;
};

// WhatsApp Forms API
export const fetchWhatsAppForms = async (params?: { status?: string; search?: string }) => {
  const response = await api.get('/automation/whatsapp-forms', { params });
  return response;
};

export const getWhatsAppForm = async (id: string) => {
  const response = await api.get(`/automation/whatsapp-forms/${id}`);
  return response;
};

export const createWhatsAppForm = async (data: any) => {
  const response = await api.post('/automation/whatsapp-forms', data);
  return response;
};

export const updateWhatsAppForm = async (id: string, data: any) => {
  const response = await api.put(`/automation/whatsapp-forms/${id}`, data);
  return response;
};

export const deleteWhatsAppForm = async (id: string) => {
  const response = await api.delete(`/automation/whatsapp-forms/${id}`);
  return response;
};

export const publishWhatsAppForm = async (id: string) => {
  const response = await api.post(`/automation/whatsapp-forms/${id}/publish`);
  return response;
};

export const unpublishWhatsAppForm = async (id: string) => {
  const response = await api.post(`/automation/whatsapp-forms/${id}/unpublish`);
  return response;
};

export const syncWhatsAppForm = async (id: string) => {
  const response = await api.post(`/automation/whatsapp-forms/${id}/sync`);
  return response;
};

export const fetchWhatsAppFormResponses = async (id: string, params?: { status?: string }) => {
  const response = await api.get(`/automation/whatsapp-forms/${id}/responses`, { params });
  return response;
};

// Consolidated Hub Summary
export const fetchAutomationHubSummary = async (params?: { days?: number }) => {
  const response = await api.get('/automation/hub/summary', { params });
  return response;
};
