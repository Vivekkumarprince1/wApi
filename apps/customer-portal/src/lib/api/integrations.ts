import api from './client';

export const getGoogleSheetsStatus = () => api.get<any>('/integrations/google/status');

export const getGoogleSheetsSpreadsheets = () => api.get<any>('/integrations/google/spreadsheets');

export const getGoogleSheetsSheets = (spreadsheetId: string) =>
  api.get<any>(`/integrations/google/spreadsheets/${spreadsheetId}/sheets`);

export const getGoogleSheetsAuthUrl = () => api.get<any>('/integrations/google/auth-url');

export const saveGoogleSheetsConfig = (data: { spreadsheetId: string; sheetName: string; syncExisting?: boolean }) =>
  api.post<any>('/integrations/google/config', data);

export const getGoogleSheetsColumns = (spreadsheetId: string, sheetName: string) =>
  api.get<any>(`/integrations/google/spreadsheets/${spreadsheetId}/columns`, { params: { sheetName } });

export const getIntegrations = () => api.get<any>('/integrations');

export const syncIntegration = (type: string) => api.post<any>(`/integrations/${type}/sync`);

export type MetaAdsIntegrationStatus = {
  connected: boolean;
  configured: boolean;
  status: 'connected' | 'pending' | 'error' | 'disconnected';
  integration?: any;
  scopes?: string[];
};

export const getMetaAdsStatus = () =>
  api.get<MetaAdsIntegrationStatus>('/integrations/meta-ads/status');

export const getMetaAdsAuthUrl = (force = false) =>
  api.get<{ url: string; scopes: string[] }>('/integrations/meta-ads/auth-url', {
    params: force ? { force: '1' } : undefined,
  });

export const refreshMetaAdsAssets = () =>
  api.post<any>('/integrations/meta-ads/refresh-assets');

export const saveMetaAdsConfig = (data: {
  adAccountId: string;
  pageId: string;
  whatsappPhoneNumberId?: string;
  whatsappPhoneNumber?: string;
  productCatalogId?: string;
  productSetId?: string;
  currency?: string;
}) =>
  api.post<any>('/integrations/meta-ads/config', data);

export const listMetaCatalogProducts = (catalogId: string, limit = 50) =>
  api.get<any>(`/integrations/meta-ads/catalogs/${catalogId}/products`, { params: { limit } });

export const syncMetaCatalogProduct = (catalogId: string, product: any) =>
  api.post<any>(`/integrations/meta-ads/catalogs/${catalogId}/products/sync`, { product });

export const createMetaProductSet = (catalogId: string, data: { name: string; filter?: any }) =>
  api.post<any>(`/integrations/meta-ads/catalogs/${catalogId}/product-sets`, data);

export const connectPetpooja = (data: {
  appKey?: string;
  appSecret?: string;
  accessToken?: string;
  restId?: string;
  vendorId?: string;
  apiKey?: string;
  baseUrl?: string;
}) =>
  api.post<any>('/integrations/petpooja/connect', data);
