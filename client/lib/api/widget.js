import { get, post, put } from './client';

export const getWidgetConfig = async () => get('/widget/config');
export const updateWidgetConfig = async (config) => put('/widget/config', config);
export const enableWidget = async () => post('/widget/enable', {});
export const disableWidget = async () => post('/widget/disable', {});
export const getWidgetAnalytics = async (params = {}) => {
  const queryParams = new URLSearchParams(params);
  return get(`/widget/analytics?${queryParams}`);
};
