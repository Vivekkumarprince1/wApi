import { get, post, put, del } from './client';

export const getIntegrations = async () => get('/integrations');
export const getIntegration = async (id) => get(`/integrations/${id}`);
export const createIntegration = async (data) => post('/integrations', data);
export const updateIntegration = async (id, data) => put(`/integrations/${id}`, data);
export const deleteIntegration = async (id) => del(`/integrations/${id}`);
