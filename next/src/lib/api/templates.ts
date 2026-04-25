import api from '@/lib/axios';

export interface Template {
  _id: string;
  id?: string;
  name: string;
  category: string;
  language: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'DRAFT' | 'DELETED' | 'FAILED' | 'IN_APPEAL';
  templateType?: 'STANDARD' | 'CAROUSEL' | 'LTO';
  qualityScore?: {
    score: string;
    confidence: string;
  };
  header?: {
    enabled: boolean;
    format: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LOCATION' | 'NONE';
    text?: string;
    handle?: string;
  };
  bodyText?: string;
  body?: {
    text: string;
  };
  footer?: {
    enabled: boolean;
    text?: string;
  };
  buttons?: {
    enabled: boolean;
    items: Array<{
      type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'COPY_CODE' | 'OTP' | 'CATALOG' | 'FLOW';
      text: string;
      url?: string;
      phoneNumber?: string;
    }>;
  };
  lto?: {
    enabled: boolean;
    hasExpiration: boolean;
    expirationTimeMs?: number;
  };
  carousel?: {
    cards: Array<{
      headerFormat: 'IMAGE' | 'VIDEO';
      mediaUrl?: string;
      mediaHandle?: string;
      bodyText: string;
      buttons: Array<{
        type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
        text: string;
        url?: string;
        phoneNumber?: string;
      }>;
    }>;
  };
  components?: any[];
  source?: 'META' | 'LOCAL' | 'BSP';
  updatedAt: string;
  createdAt: string;
}

// Meta Library Template (from Gupshup/Meta pre-approved library)
export interface MetaLibraryTemplate {
  name: string;
  language: string;
  category: string;
  components: any[];
  status?: string;
  vertical?: string;
}

export interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export type TemplateRuleTriggerType =
  | 'message_keyword'
  | 'conversation_event'
  | 'user_action'
  | 'time_trigger'
  | 'custom'
  | 'instagram_comment'
  | 'instagram_dm'
  | 'instagram_story_reply';

export type TemplateRuleMatchMode = 'exact' | 'starts_with' | 'contains' | 'regex';

export interface TemplateRuleTimeWindow {
  startTime: string;
  endTime: string;
  timezone: string;
}

export interface TemplateRuleConditions {
  conversationStatus: string;
  timeWindow: TemplateRuleTimeWindow;
  country: string;
  requiresTags: string[];
}

export interface TemplateRuleRateLimit {
  enabled: boolean;
  window: number;
  maxTriggers: number;
}

export interface TemplateRuleTemplateRef {
  _id: string;
  name: string;
}

export interface TemplateRuleSummaryStats {
  successful: number;
  failed: number;
  skipped: number;
  lastErrors: string[];
}

export interface TemplateRule {
  _id: string;
  id?: string;
  name: string;
  description?: string;
  triggerType: TemplateRuleTriggerType;
  keywords: string[];
  matchMode: TemplateRuleMatchMode;
  template?: string | TemplateRuleTemplateRef | null;
  conditions: TemplateRuleConditions;
  rateLimit: TemplateRuleRateLimit;
  priority: number;
  enabled: boolean;
}

export interface TemplateRuleFormData {
  name: string;
  description: string;
  triggerType: TemplateRuleTriggerType;
  keywords: string[];
  matchMode: TemplateRuleMatchMode;
  template: string;
  conditions: TemplateRuleConditions;
  rateLimit: TemplateRuleRateLimit;
  priority: number;
  enabled: boolean;
}

export type TemplateRuleFormPayload = TemplateRuleFormData & { id?: string };

export interface TemplateListResponse extends ApiResponse<Template[]> {
  data: Template[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export interface TemplateRulePagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface TemplateRuleListData {
  rules: TemplateRule[];
  pagination: TemplateRulePagination;
}

export interface TemplateRuleListResponse extends ApiResponse<TemplateRuleListData> {
  data: TemplateRuleListData;
}

export interface TemplateRuleStatsData {
  period: string;
  overview: {
    total: number;
    success: number;
    failed: number;
    skipped: number;
  };
  successRate: number;
  rules: {
    enabled: number;
    total: number;
  };
  dailyTrend: Array<{
    _id: string;
    count: number;
    success: number;
  }>;
}

export interface TemplateRuleStatsResponse extends ApiResponse<TemplateRuleStatsData> {
  data: TemplateRuleStatsData;
}

export interface TemplateRuleTestData {
  rule: {
    id: string;
    name: string;
    enabled: boolean;
    category?: string;
    actions?: number;
  };
  conversation: {
    id: string;
    contact?: string;
  };
  execution: {
    result: unknown;
    context: {
      contactId: string;
      messageBody: string;
      testMode: boolean;
    };
    timestamp: string;
  };
  dryRun: boolean;
  info: string;
}

export interface TemplateRuleTestResponse extends ApiResponse<TemplateRuleTestData> {
  data: TemplateRuleTestData;
}

export const fetchTemplates = async (params = {}): Promise<TemplateListResponse> => {
  const response = await api.get('/templates', { params });
  return response;
};

export const fetchTemplateCategories = async (): Promise<any> => {
  const response = await api.get('/templates/categories');
  return response;
};

export const fetchTemplateLibraryStats = async (): Promise<any> => {
  const response = await api.get('/templates/library/stats');
  return response;
};

export const syncTemplates = async (params = { force: true }): Promise<any> => {
  const response = await api.post('/templates/sync', params);
  return response;
};

export const createTemplate = async (data: any): Promise<any> => {
  const response = await api.post('/templates', data);
  return response;
};

export const updateTemplate = async (id: string, data: any): Promise<any> => {
  const response = await api.put(`/templates/${id}`, data);
  return response;
};

export const deleteTemplate = async (id: string): Promise<any> => {
  const response = await api.delete(`/templates/${id}`);
  return response;
};

export const submitTemplateToMeta = async (id: string): Promise<any> => {
  const response = await api.post(`/templates/${id}/submit`, {});
  return response;
};


// ============= ANALYTICS =============

export const getWorkspaceAnalytics = async (dateRange = {}) => {
  const params = new URLSearchParams(dateRange as any).toString();
  const response = await api.get(`/templates/analytics/workspace${params ? '?' + params : ''}`);
  return response;
};

export const getTopPerformingTemplates = async (limit = 10) => {
  const response = await api.get(`/templates/analytics/top-performers?limit=${limit}`);
  return response;
};

export const getLowPerformingTemplates = async (limit = 10) => {
  const response = await api.get(`/templates/analytics/low-performers?limit=${limit}`);
  return response;
};

export const getTemplateBehavioralInsights = async (params = {}) => {
  const query = new URLSearchParams(params as any).toString();
  const response = await api.get(`/templates/analytics/behavioral${query ? '?' + query : ''}`);
  return response;
};

export const exportAnalyticsReport = async (format = 'json') => {
  const response = await api.get(`/templates/analytics/export?format=${format}`);
  return response;
};

/**
 * Get MM Lite / Gupshup template performance insights.
 * Returns: sent, delivered, read, clicks, spend, CPD, CPClick, add-to-cart, purchases.
 * Gupshup endpoint: GET /partner/app/{appId}/template/insights
 */
export const getTemplateInsights = async (templateName: string, dateRange?: { startDate: string; endDate: string }) => {
  const params: any = { templateName };
  if (dateRange) {
    params.startDate = dateRange.startDate;
    params.endDate = dateRange.endDate;
  }
  const response = await api.get('/templates/analytics/insights', { params });
  return response;
};

/**
 * Compare template performance against workspace averages.
 * Gupshup endpoint: GET /partner/app/{appId}/template/analytics/{templateId}/compare
 */
export const compareTemplatePerformance = async (templateId: string) => {
  const response = await api.get(`/templates/analytics/${templateId}/compare`);
  return response;
};

// ============= TEMPLATE RULES =============

export const fetchTemplateRules = async (
  params: Record<string, string | number | boolean | undefined> = {}
): Promise<TemplateRuleListResponse> => {
  const queryString = new URLSearchParams(params as any).toString();
  const response = await api.get(`/rules${queryString ? '?' + queryString : ''}`);
  return response;
};

export const fetchTemplateRule = async (ruleId: string): Promise<ApiResponse<TemplateRule>> => {
  const response = await api.get(`/rules/${ruleId}`);
  return response;
};

export const createTemplateRule = async (ruleData: TemplateRuleFormPayload): Promise<ApiResponse<TemplateRule>> => {
  const response = await api.post('/rules', ruleData);
  return response;
};

export const updateTemplateRule = async (
  ruleId: string,
  updates: TemplateRuleFormPayload
): Promise<ApiResponse<TemplateRule>> => {
  const response = await api.put(`/rules/${ruleId}`, updates);
  return response;
};

export const deleteTemplateRule = async (ruleId: string): Promise<ApiResponse<null>> => {
  const response = await api.delete(`/rules/${ruleId}`);
  return response;
};

export const toggleTemplateRule = async (
  ruleId: string,
  enabled: boolean
): Promise<ApiResponse<{ enabled: boolean }>> => {
  const response = await api.post(`/rules/${ruleId}/toggle`, { enabled });
  return response;
};

export const testTemplateRule = async (
  ruleId: string,
  testData: Record<string, unknown>
): Promise<TemplateRuleTestResponse> => {
  const response = await api.post(`/rules/${ruleId}/test`, testData);
  return response;
};

export const getRuleStats = async (ruleId: string): Promise<TemplateRuleStatsResponse> => {
  const response = await api.get(`/rules/${ruleId}/stats`);
  return response;
};

// Trigger types for rules
export const TRIGGER_TYPES = [
  { value: 'message_keyword', label: 'Message Keyword' },
  { value: 'conversation_event', label: 'Conversation Event' },
  { value: 'user_action', label: 'User Action' },
  { value: 'time_trigger', label: 'Time-based' },
  { value: 'custom', label: 'Custom' },
  { value: 'instagram_comment', label: 'Instagram Comment' },
  { value: 'instagram_dm', label: 'Instagram DM' },
  { value: 'instagram_story_reply', label: 'Instagram Story Reply' }
];

export const MATCH_MODES = [
  { value: 'exact', label: 'Exact Match' },
  { value: 'starts_with', label: 'Starts With' },
  { value: 'contains', label: 'Contains' },
  { value: 'regex', label: 'Regex Pattern' }
];
