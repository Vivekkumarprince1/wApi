import api, { unwrapData } from './client';

export const getAdvancedChatAnalytics = (days: number) =>
  api.get<any>('/analytics/chat/advanced', { params: { days } }).then(unwrapData);

export const getDashboardOverview = () =>
  api.get<any>('/analytics/dashboard/overview').then(unwrapData);

export const getMessageMetrics = (days: number) =>
  api.get<any>('/metrics/messages', { params: { days } }).then(unwrapData);
