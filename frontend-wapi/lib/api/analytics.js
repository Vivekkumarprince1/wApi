import { get, post, put } from './client';

export const getAnalyticsDashboardOverview = async (params = {}) => {
  const queryParams = new URLSearchParams(params);
  return get(`/analytics/dashboard/overview?${queryParams}`);
};

export const getAnalyticsDashboardConversations = async (params = {}) => {
  const queryParams = new URLSearchParams(params);
  return get(`/analytics/dashboard/conversations?${queryParams}`);
};

export const getAnalyticsDashboardAgents = async (params = {}) => {
  const queryParams = new URLSearchParams(params);
  return get(`/analytics/dashboard/agents?${queryParams}`);
};

export const getAnalyticsDashboardMessages = async (params = {}) => {
  const queryParams = new URLSearchParams(params);
  return get(`/analytics/dashboard/messages?${queryParams}`);
};

export const getMessageMetrics = async (days = 7) => get(`/metrics/messages?days=${days}`);

export const getTemplateMetrics = async (days = 30) => get(`/metrics/metrics/templates?days=${days}`);

export const getQuotaReport = async () => get('/reports/quota');

export const getCurrentMonthBilling = async () => get('/billing/conversations/current-month');

export const getBillingPreview = async (params = {}) => {
  const queryParams = new URLSearchParams(params);
  return get(`/analytics/dashboard/billing?${queryParams}`);
};
