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

export const fetchContacts = (page?: number, limit?: number, params?: any) => api.get<any>('/contacts', { params: { ...params, page, limit } });
export const fetchContactById = (id: string) => api.get<any>(`/contacts/${id}`);
export const createContact = (data: any) => api.post<any>('/contacts', data);
export const updateContact = (id: string, data: any) => api.patch<any>(`/contacts/${id}`, data);
export const deleteContact = (id: string) => api.delete<any>(`/contacts/${id}`);

/** Segments are served by the campaign microservice via main-server proxy */
export const getSegments = () =>
  api.get<any>('/campaign/segments').then((res: any) => res.segments || unwrap(res));
export const fetchSegments = getSegments;
export const createSegment = (data: any) => api.post<any>('/campaign/segments', data);
export const deleteSegment = (id: string) => api.delete<any>(`/campaign/segments/${id}`);
export const fetchTags = () => api.get<any>('/workspace/tags').then(unwrap);

export const importContacts = (data: any) => api.post('/contacts/import', data);
