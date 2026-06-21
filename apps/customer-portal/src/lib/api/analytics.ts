import api from './client';

export const getAdvancedChatAnalytics = (days: number) =>
  api.get<any>('/analytics/chat/advanced', { params: { days } }).then((r: any) => r.data);

export const getDashboardOverview = () =>
  api.get<any>('/analytics/dashboard/overview').then((r: any) => r.data);

export const getMessageMetrics = (days: number) =>
  api.get<any>('/metrics/messages', { params: { days } }).then((r: any) => r.data);
