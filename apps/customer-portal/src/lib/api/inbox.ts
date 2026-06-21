import api from './client';

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
  subject?: string;
  emailHtml?: string;
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
  channel: 'whatsapp' | 'messenger' | 'instagram' | 'sms' | 'email';
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

export const fetchConversations = (params?: any) => api.get<any>('/inbox', { params });
export const fetchMessages = (conversationId: string, params?: any) => api.get<any>(`/inbox/conversations/${conversationId}/messages`, { params });
export const fetchMessagesByContactId = (contactId: string, params?: any) => api.get<any>(`/inbox/messages/contact/${contactId}`, { params });
export const sendMessage = (conversationId: string, data: any, headers: any = {}) => api.post(`/inbox/conversations/${conversationId}/messages`, data, { headers });

export const sendMediaMessage = (conversationId: string, data: any, headers: any = {}) => api.post(`/inbox/conversations/${conversationId}/messages`, {
  type: data.mediaType || 'image',
  media: {
    url: data.mediaUrl,
    mimeType: data.mimeType,
    filename: data.filename,
    caption: data.caption
  }
}, { headers });

export const markAsRead = (conversationId: string) => api.post(`/inbox/conversations/${conversationId}/read`);
export const performConversationAction = (conversationId: string, action: string, data = {}) => api.patch(`/inbox/conversations/${conversationId}/action`, { action, ...data });

export const fetchTeams = () => api.get<any>('/workspace/teams');
export const fetchMembers = () => api.get<any>('/workspace/team/members');

export const uploadMedia = (file: File, folder?: string) => {
  const formData = new FormData();
  formData.append('file', file);
  if (folder) formData.append('folder', folder);
  return api.post('/upload/media', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};
