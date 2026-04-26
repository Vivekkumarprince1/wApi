import api from '@/lib/axios';

export interface Contact {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  tags?: string[];
  avatar?: string;
  avatarUrl?: string;
  lastMessageAt?: string;
  leadStatus?: string;
  createdAt: string;
}

export interface Segment {
  _id: string;
  name: string;
  description?: string;
  filters: {
    tags?: string[];
    notTags?: string[];
  };
  contactCount?: number;
  createdAt: string;
}

export const fetchContacts = async (page = 1, limit = 50, params = {}): Promise<any> => {
  return await api.get('/contacts', {
    params: { page, limit, ...params }
  });
};

export const fetchTags = async (): Promise<any> => {
  return await api.get('/tags');
};

export const getSegments = async (): Promise<any> => {
  return await api.get('/segments');
};

export const fetchSegments = getSegments;

export const createSegment = async (data: any): Promise<any> => {
  return await api.post('/segments', data);
};

export const deleteSegment = async (id: string): Promise<any> => {
  return await api.delete(`/segments/${id}`);
};

export const createContact = async (data: any): Promise<any> => {
  return await api.post('/contacts', data);
};

export const updateContact = async (id: string, data: any): Promise<any> => {
  return await api.patch(`/contacts/${id}`, data);
};

export const deleteContact = async (id: string): Promise<any> => {
  return await api.delete(`/contacts/${id}`);
};

export const importContacts = async (formData: FormData): Promise<any> => {
  return await api.post('/contacts/import', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
};
