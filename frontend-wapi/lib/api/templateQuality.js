/**
 * Template Quality & Analytics API
 * Handles quality scores, analytics, and rule management
 */

import { get, post, put, del } from './client';

// ============= QUALITY SCORES =============

export const getTemplateQuality = async (templateId) => {
  return get(`/templates/${templateId}/quality`);
};

export const getQualityIssues = async (templateId) => {
  return get(`/templates/${templateId}/quality/issues`);
};

export const getWorkspaceQualityReport = async () => {
  return get('/templates/quality/workspace-report');
};

export const analyzeRejectionPatterns = async () => {
  return get('/templates/quality/rejection-patterns');
};

export const compareTemplateVersions = async (originalId, forkedId) => {
  return post('/templates/quality/compare-versions', {
    originalTemplateId: originalId,
    forkedTemplateId: forkedId
  });
};

// ============= ANALYTICS =============

export const getTemplateAnalytics = async (templateId, dateRange = {}) => {
  const params = new URLSearchParams(dateRange).toString();
  return get(`/templates/${templateId}/analytics${params ? '?' + params : ''}`);
};

export const getWorkspaceAnalytics = async (dateRange = {}) => {
  const params = new URLSearchParams(dateRange).toString();
  return get(`/templates/analytics/workspace${params ? '?' + params : ''}`);
};

export const compareTemplates = async (templateIds, dateRange = {}) => {
  const params = new URLSearchParams(dateRange).toString();
  return post(`/templates/analytics/compare${params ? '?' + params : ''}`, {
    templateIds
  });
};

export const getTopPerformingTemplates = async (limit = 10) => {
  return get(`/templates/analytics/top-performers?limit=${limit}`);
};

export const getLowPerformingTemplates = async (limit = 10) => {
  return get(`/templates/analytics/low-performers?limit=${limit}`);
};

export const getTemplateBehavioralInsights = async (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return get(`/templates/analytics/behavioral${query ? '?' + query : ''}`);
};

export const exportAnalyticsReport = async (format = 'json') => {
  return get(`/templates/analytics/export?format=${format}`);
};

// ============= TEMPLATE RULES =============

export const fetchTemplateRules = async (params = {}) => {
  const queryString = new URLSearchParams(params).toString();
  return get(`/rules${queryString ? '?' + queryString : ''}`);
};

export const fetchTemplateRule = async (ruleId) => {
  return get(`/rules/${ruleId}`);
};

export const createTemplateRule = async (ruleData) => {
  return post('/rules', ruleData);
};

export const updateTemplateRule = async (ruleId, updates) => {
  return put(`/rules/${ruleId}`, updates);
};

export const deleteTemplateRule = async (ruleId) => {
  return del(`/rules/${ruleId}`);
};

export const toggleTemplateRule = async (ruleId, enabled) => {
  return post(`/rules/${ruleId}/toggle`, { enabled });
};

export const testTemplateRule = async (ruleId, testData) => {
  return post(`/rules/${ruleId}/test`, testData);
};

export const getRuleStats = async (ruleId) => {
  return get(`/rules/${ruleId}/stats`);
};

// Helper function to get quality color class
export const getQualityColorClass = (score) => {
  switch (score?.toUpperCase()) {
    case 'GREEN':
      return 'bg-green-100 text-green-800 border-green-300';
    case 'YELLOW':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'RED':
      return 'bg-red-100 text-red-800 border-red-300';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
};

export const getQualityLabel = (score) => {
  switch (score?.toUpperCase()) {
    case 'GREEN':
      return 'Excellent';
    case 'YELLOW':
      return 'Good';
    case 'RED':
      return 'Needs Review';
    default:
      return 'Unknown';
  }
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
