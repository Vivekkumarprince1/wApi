import { get, post, put, del } from './client';

export const generateAnswerBotFAQs = async (workspaceId, data) => post(`/automation/answerbot/${workspaceId}/generate`, data);
export const getAnswerBotFAQs = async (workspaceId) => get(`/automation/answerbot/${workspaceId}/faqs`);
export const approveAnswerBotFAQs = async (workspaceId, ids) => post(`/automation/answerbot/${workspaceId}/approve`, { faqIds: ids });
export const deleteAnswerBotFAQ = async (workspaceId, id) => del(`/automation/answerbot/${workspaceId}/faqs/${id}`);
export const getAnswerBotSources = async (workspaceId) => get(`/automation/answerbot/${workspaceId}/sources`);

// New endpoints
export const addAnswerBotSource = async (workspaceId, data) => post(`/automation/answerbot/${workspaceId}/sources`, data);
export const getAnswerBotSettings = async (workspaceId) => get(`/automation/answerbot/${workspaceId}/settings`);
export const updateAnswerBotSettings = async (workspaceId, data) => put(`/automation/answerbot/${workspaceId}/settings`, data);
