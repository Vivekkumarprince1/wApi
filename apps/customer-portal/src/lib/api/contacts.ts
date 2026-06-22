import api from './client';

function unwrap<T = any>(res: any): T {
  if (res && typeof res === 'object' && 'data' in res && res.data !== undefined) return res.data as T;
  return res as T;
}

export interface Contact {
  _id: string;
  name: string;
  phone: string;
  [key: string]: any;
}
export interface Segment {
  _id: string;
  name: string;
  description?: string;
  filters?: any;
  contactCount?: number;
}

export function getContactsFromResponse(response: any): Contact[] {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.contacts)) return response.contacts;
  if (Array.isArray(response?.data?.contacts)) return response.data.contacts;
  return [];
}

export function getContactTotalFromResponse(response: any) {
  const contacts = getContactsFromResponse(response);
  return Number(
    response?.meta?.total ??
    response?.pagination?.total ??
    response?.data?.meta?.total ??
    response?.data?.pagination?.total ??
    response?.total ??
    contacts.length
  );
}

export const fetchContacts = (page?: number, limit?: number, params?: any) => api.get<any>('/contacts', { params: { ...params, page, limit } });
export const fetchContactById = (id: string) => api.get<any>(`/contacts/${id}`);
export const createContact = (data: any) => api.post<any>('/contacts', data);
export const updateContact = (id: string, data: any) => api.patch<any>(`/contacts/${id}`, data);
export const deleteContact = (id: string) => api.delete<any>(`/contacts/${id}`);
export const fetchContactFormSubmissions = (id: string) =>
  api.get<any>(`/contacts/${id}/form-submissions`);
export const sendTemplateToContact = (contactId: string, data: any) =>
  api.post<any>(`/contacts/${contactId}/send-template`, data);

/** Segments are served by the campaign microservice via main-server proxy */
export const getSegments = () =>
  api.get<any>('/campaign/segments').then((res: any) => res.segments || unwrap(res));
export const fetchSegments = getSegments;
export const createSegment = (data: any) => api.post<any>('/campaign/segments', data);
export const deleteSegment = (id: string) => api.delete<any>(`/campaign/segments/${id}`);
export const fetchTags = () => api.get<any>('/workspace/tags').then(unwrap);

export const importContacts = (data: any) => api.post('/bulk/contacts/import', data);
export const bulkTagContacts = (contactIds: string[], tags: string[]) =>
  api.post<any>('/bulk/contacts/tag', { contactIds, tags });
export const bulkDeleteContacts = (contactIds: string[]) =>
  api.post<any>('/bulk/contacts/delete', { contactIds });
export const getContactsExportUrl = (params?: URLSearchParams) =>
  `/api/v1/bulk/contacts/export${params?.size ? `?${params}` : ''}`;

export const getCsvImportProgress = (jobId: string) =>
  api.get<any>(`/bulk/contacts/csv-import/${jobId}/progress`);

export const uploadCsvImport = (data: { csvContent: string; fileName: string }) =>
  api.post<any>('/bulk/contacts/csv-import/upload', data);

export const cancelCsvImport = (jobId: string) =>
  api.delete<any>(`/bulk/contacts/csv-import/${jobId}/cancel`);
