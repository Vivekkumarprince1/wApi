import { apiClient } from './client';

export const automationApi = {
  getRules: (params) => apiClient.get('/automation/rules', { params }),
  getRule: (ruleId) => apiClient.get(`/automation/rules/${ruleId}`),
  createRule: (data) => apiClient.post('/automation/rules', data),
  updateRule: (ruleId, data) => apiClient.put(`/automation/rules/${ruleId}`, data),
  deleteRule: (ruleId) => apiClient.delete(`/automation/rules/${ruleId}`),
  toggleRule: (ruleId, enabled) => apiClient.patch(`/automation/rules/${ruleId}/enable`, { enabled }),
  getLogs: (params) => apiClient.get('/automation/logs', { params }),
  getStatus: () => apiClient.get('/automation/status'),
};
