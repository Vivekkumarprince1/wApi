import api from '@/lib/axios';

export interface Message {
  _id: string;
  whatsappMessageId?: string | { id: string };
  body?: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'interactive' | 'location' | 'template' | 'note' | 'contacts' | 'reaction' | 'system';
  direction: 'inbound' | 'outbound';
  status: 'sent' | 'delivered' | 'read' | 'failed' | 'queued' | 'received';
  createdAt: string;
  contact?: string | any;
  sentBy?: any;
  meta?: any;
  media?: {
    url: string;
    link?: string;
    filename?: string;
    caption?: string;
  };
  isInternalNote?: boolean;
  repliedTo?: string;
}

export interface Conversation {
  _id: string;
  contact: {
    _id: string;
    name: string;
    phone: string;
    avatar?: string;
    tags?: string[];
  };
  channel: 'whatsapp' | 'messenger' | 'instagram';
  lastMessage?: Message;
  lastMessageAt: string;
  unreadCount: number;
  myUnreadCount: number;
  isOpen?: boolean;
  windowExpiresAt?: string;
  status: 'open' | 'pending' | 'resolved' | 'closed' | 'snoozed' | 'spam';
  assignedTo?: {
    _id: string;
    name: string;
  };
  priority: 'low' | 'normal' | 'high' | 'urgent';
  labels?: string[];
}

export const fetchConversations = async (params = {}) => {
  const response = await api.get('/inbox', { params });
  return response;
};

export const fetchTeams = async () => {
  const response = await api.get('/workspace/team');
  return response;
};

export const fetchMembers = async () => {
  const response = await api.get('/workspace/team/members');
  return response;
};

export const fetchMessages = async (id: string, params = {}) => {
  const response = await api.get(`/inbox/${id}/messages`, { params });
  return response;
};

export const markAsRead = async (id: string) => {
  const response = await api.post(`/inbox/${id}/read`, {});
  return response;
};

export const sendMessage = async (id: string, data: any) => {
  const response = await api.post(`/inbox/${id}/messages`, data);
  return response;
};

export const sendMediaMessage = async (id: string, data: any) => {
  const response = await api.post(`/inbox/${id}/messages`, {
    type: data.mediaType || 'image',
    media: {
      url: data.mediaUrl,
      mimeType: data.mimeType,
      filename: data.filename,
      caption: data.caption
    }
  });
  return response;
};

/**
 * Unified conversation action helper
 */
export const performConversationAction = async (id: string, action: string, data = {}) => {
  const response = await api.patch(`/inbox/${id}`, { action, ...data });
  return response;
};

export const uploadMedia = async (file: File): Promise<{ url?: string; data?: { url?: string } }> => {
  const formData = new FormData();
  formData.append('file', file);
  const response: any = await api.post('/upload/media', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response?.data ? response : { ...response, data: response };
};

export const fetchMessagesByContactId = async (contactId: string, params = {}) => {
  const response = await api.get(`/inbox/messages/contact/${contactId}`, { params });
  return response;
};
