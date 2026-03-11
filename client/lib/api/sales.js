import { get, post, put, del } from './client';

// Pipelines
export const createPipeline = async (data) => post('/sales/pipelines', data);
export const getPipelines = async () => get('/sales/pipelines');
export const getDefaultPipeline = async () => get('/sales/pipelines/default/pipeline');
export const getPipeline = async (pipelineId) => get(`/sales/pipelines/${pipelineId}`);
export const updatePipeline = async (pipelineId, data) => put(`/sales/pipelines/${pipelineId}`, data);
export const deletePipeline = async (pipelineId) => del(`/sales/pipelines/${pipelineId}`);

// Deals
export const createDeal = async (data) => post('/sales/deals', data);
export const listDeals = async (filters) => {
  const queryParams = new URLSearchParams(filters);
  return get(`/sales/deals?${queryParams}`);
};
export const getDeal = async (dealId) => get(`/sales/deals/${dealId}`);
export const getDealsByContact = async (contactId) => get(`/sales/deals/contact/${contactId}`);
export const getDealsByStage = async (pipelineId) => get(`/sales/deals/pipeline/${pipelineId}/stages`);
export const moveDealStage = async (dealId, stageId) => post(`/sales/deals/${dealId}/move`, { stageId });
export const updateDeal = async (dealId, data) => put(`/sales/deals/${dealId}`, data);
export const addDealNote = async (dealId, text) => post(`/sales/deals/${dealId}/notes`, { text });
export const deleteDeal = async (dealId) => del(`/sales/deals/${dealId}`);

// Sales Reports
export const getPipelinePerformanceReport = async (filters) => {
  const queryParams = new URLSearchParams(filters);
  return get(`/sales/reports/pipeline-performance?${queryParams}`);
};
export const getFunnelReport = async (pipelineId, filters) => {
  const queryParams = new URLSearchParams({ ...filters, pipelineId });
  return get(`/sales/reports/funnel?${queryParams}`);
};
export const getAgentPerformanceReport = async (filters) => {
  const queryParams = new URLSearchParams(filters);
  return get(`/sales/reports/agent-performance?${queryParams}`);
};
export const getDealVelocityReport = async (filters) => {
  const queryParams = new URLSearchParams(filters);
  return get(`/sales/reports/deal-velocity?${queryParams}`);
};
export const getStageDurationReport = async (pipelineId, filters) => {
  const queryParams = new URLSearchParams({ ...filters, pipelineId });
  return get(`/sales/reports/stage-duration?${queryParams}`);
};

// Ads
export const checkAdsEligibility = async () => get('/ads/check-eligibility');
export const createAd = async (adData) => post('/ads', adData);
export const listAds = async (status, page = 1, limit = 20) => {
  const params = new URLSearchParams({ status, page: page.toString(), limit: limit.toString() });
  return get(`/ads?${params}`);
};
export const getAd = async (adId) => get(`/ads/${adId}`);
export const updateAd = async (adId, updates) => put(`/ads/${adId}`, updates);
export const pauseAd = async (adId, reason) => post(`/ads/${adId}/pause`, { reason });
export const resumeAd = async (adId) => post(`/ads/${adId}/resume`, {});
export const deleteAd = async (adId) => del(`/ads/${adId}`);
export const getAdAnalytics = async (adId) => get(`/ads/${adId}/analytics`);

// Commerce
export const getCommerceSettings = async () => get('/settings/commerce');
export const updateCommerceSettings = async (settings) => put('/settings/commerce', settings);
export const validateCommerceConfig = async () => post('/settings/commerce/validate', {});

// Workflows
export const getWorkflows = async (filters) => {
  const queryParams = new URLSearchParams(filters);
  return get(`/automation?${queryParams}`);
};
export const getWorkflow = async (workflowId) => get(`/automation/${workflowId}`);
export const createWorkflow = async (workflowData) => post('/automation', workflowData);
export const updateWorkflow = async (workflowId, workflowData) => put(`/automation/${workflowId}`, workflowData);
export const toggleWorkflow = async (workflowId) => post(`/automation/${workflowId}/toggle`, {});
export const deleteWorkflow = async (workflowId) => del(`/automation/${workflowId}`);
export const getWorkflowExecutions = async (workflowId, filters) => {
  const queryParams = new URLSearchParams(filters);
  return get(`/automation/${workflowId}/executions?${queryParams}`);
};
export const getWorkflowAnalytics = async (dateRange) => {
  const queryParams = new URLSearchParams(dateRange);
  return get(`/automation/analytics?${queryParams}`);
};

// Auto-Replies
export const getAutoReplies = async (filters) => {
  const queryParams = new URLSearchParams(filters);
  return get(`/auto-replies?${queryParams}`);
};
export const getAutoReply = async (autoReplyId) => get(`/auto-replies/${autoReplyId}`);
export const createAutoReply = async (autoReplyData) => post('/auto-replies', autoReplyData);
export const updateAutoReply = async (autoReplyId, autoReplyData) => put(`/auto-replies/${autoReplyId}`, autoReplyData);
export const toggleAutoReply = async (autoReplyId) => post(`/auto-replies/${autoReplyId}/toggle`, {});
export const deleteAutoReply = async (autoReplyId) => del(`/auto-replies/${autoReplyId}`);

// Instagram Quickflows
export const getInstagramQuickflows = async (filters) => {
  const queryParams = new URLSearchParams(filters);
  return get(`/instagram-quickflows?${queryParams}`);
};
export const getInstagramQuickflow = async (quickflowId) => get(`/instagram-quickflows/${quickflowId}`);
export const createInstagramQuickflow = async (quickflowData) => post('/instagram-quickflows', quickflowData);
export const updateInstagramQuickflow = async (quickflowId, quickflowData) => put(`/instagram-quickflows/${quickflowId}`, quickflowData);
export const toggleInstagramQuickflow = async (quickflowId) => post(`/instagram-quickflows/${quickflowId}/toggle`, {});
export const deleteInstagramQuickflow = async (quickflowId) => del(`/instagram-quickflows/${quickflowId}`);
export const getInstagramQuickflowStats = async (quickflowId) => get(`/instagram-quickflows/${quickflowId}/stats`);

// WhatsApp Forms
export const getWhatsAppForms = async (filters) => {
  const queryParams = new URLSearchParams(filters);
  return get(`/whatsapp-forms?${queryParams}`);
};
export const getWhatsAppForm = async (formId) => get(`/whatsapp-forms/${formId}`);
export const createWhatsAppForm = async (formData) => post('/whatsapp-forms', formData);
export const updateWhatsAppForm = async (formId, formData) => put(`/whatsapp-forms/${formId}`, formData);
export const deleteWhatsAppForm = async (formId) => del(`/whatsapp-forms/${formId}`);

// Admin
export const getAllWorkspaces = async (filters) => {
  const queryParams = new URLSearchParams(filters);
  return get(`/admin/workspaces?${queryParams}`);
};
export const getWorkspaceDetails = async (workspaceId) => get(`/admin/workspaces/${workspaceId}`);
export const suspendWorkspace = async (workspaceId, reason) => post(`/admin/workspaces/${workspaceId}/suspend`, { reason });
export const resumeWorkspace = async (workspaceId) => post(`/admin/workspaces/${workspaceId}/resume`, {});
export const getWABAHealth = async (filters) => {
  const queryParams = new URLSearchParams(filters);
  return get(`/admin/waba-health?${queryParams}`);
};
export const getAdminAnalytics = async (filters) => {
  const queryParams = new URLSearchParams(filters);
  return get(`/admin/analytics?${queryParams}`);
};
export const getAuditLogs = async (filters) => {
  const queryParams = new URLSearchParams(filters);
  return get(`/audit-logs?${queryParams}`);
};
export const getTemplatesForApproval = async (filters) => {
  const queryParams = new URLSearchParams(filters);
  return get(`/admin/templates/approval?${queryParams}`);
};
export const updateTemplateApprovalStatus = async (templateId, status, rejectionReason) => {
  return put(`/admin/templates/${templateId}/status`, { status, rejectionReason });
};
export const getCampaignAnalytics = async () => get('/admin/campaigns/analytics');
