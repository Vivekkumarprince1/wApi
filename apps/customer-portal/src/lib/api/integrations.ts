import api from './client';

export const getGoogleSheetsStatus = () => api.get<any>('/integrations/google/status');

export const getGoogleSheetsSpreadsheets = () => api.get<any>('/integrations/google/spreadsheets');

export const getGoogleSheetsSheets = (spreadsheetId: string) =>
  api.get<any>(`/integrations/google/spreadsheets/${spreadsheetId}/sheets`);

export const getGoogleSheetsAuthUrl = () => api.get<any>('/integrations/google/auth-url');

export const saveGoogleSheetsConfig = (data: { spreadsheetId: string; sheetName: string }) =>
  api.post<any>('/integrations/google/config', data);

export const getGoogleSheetsColumns = (spreadsheetId: string, sheetName: string) =>
  api.get<any>(`/integrations/google/spreadsheets/${spreadsheetId}/columns`, { params: { sheetName } });

export const getIntegrations = () => api.get<any>('/integrations');

export const syncIntegration = (type: string) => api.post<any>(`/integrations/${type}/sync`);

export const connectPetpooja = (data: { vendorId: string; apiKey: string }) =>
  api.post<any>('/integrations/petpooja/connect', data);
