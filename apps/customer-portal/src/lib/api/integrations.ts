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

export type InstagramIntegrationStatus = {
  connected: boolean;
  status: 'connected' | 'pending' | 'error' | 'disconnected';
  integration?: any;
  billing?: {
    planSlug?: string | null;
    pricePaise?: number;
    currency?: string;
  };
};

export const getInstagramStatus = () =>
  api.get<InstagramIntegrationStatus>('/integrations/instagram/status');

export const getInstagramAuthUrl = (force = false) =>
  api.get<{ url: string; scopes: string[]; subscribedFields: string[] }>('/integrations/instagram/auth-url', {
    params: force ? { force: '1' } : undefined,
  });

export const refreshInstagramToken = () =>
  api.post<any>('/integrations/instagram/refresh-token');

export type InstagramGraphResponse<T = any> = {
  success: boolean;
  data: T;
  instagramAccountId?: string;
};

export const instagramGraph = (data: {
  method?: 'GET' | 'POST' | 'DELETE';
  path: string;
  query?: Record<string, any>;
  body?: Record<string, any>;
  graphHost?: 'instagram' | 'facebook';
}) => api.post<InstagramGraphResponse>('/integrations/instagram/graph', data);

export const getInstagramProfile = (params?: any) =>
  api.get<InstagramGraphResponse>('/integrations/instagram/profile', { params });

export const listInstagramMedia = (params?: any) =>
  api.get<InstagramGraphResponse>('/integrations/instagram/media', { params });

export const createInstagramMediaContainer = (data: any) =>
  api.post<InstagramGraphResponse>('/integrations/instagram/media', data);

export const publishInstagramMedia = (data: { creationId?: string; creation_id?: string }) =>
  api.post<InstagramGraphResponse>('/integrations/instagram/media/publish', data);

export const getInstagramPublishingLimit = (params?: any) =>
  api.get<InstagramGraphResponse>('/integrations/instagram/media/publishing-limit', { params });

export const getInstagramMedia = (mediaId: string, params?: any) =>
  api.get<InstagramGraphResponse>(`/integrations/instagram/media/${mediaId}`, { params });

export const updateInstagramMediaSettings = (mediaId: string, data: any) =>
  api.post<InstagramGraphResponse>(`/integrations/instagram/media/${mediaId}/settings`, data);

export const deleteInstagramMedia = (mediaId: string) =>
  api.delete<InstagramGraphResponse>(`/integrations/instagram/media/${mediaId}`);

export const getInstagramMediaChildren = (mediaId: string, params?: any) =>
  api.get<InstagramGraphResponse>(`/integrations/instagram/media/${mediaId}/children`, { params });

export const getInstagramMediaCollaborators = (mediaId: string, params?: any) =>
  api.get<InstagramGraphResponse>(`/integrations/instagram/media/${mediaId}/collaborators`, { params });

export const getInstagramMediaInsights = (mediaId: string, params: { metric: string; period?: string; breakdown?: string }) =>
  api.get<InstagramGraphResponse>(`/integrations/instagram/media/${mediaId}/insights`, { params });

export const listInstagramProductTags = (mediaId: string, params?: any) =>
  api.get<InstagramGraphResponse>(`/integrations/instagram/media/${mediaId}/product-tags`, { params });

export const updateInstagramProductTags = (mediaId: string, data: { tags?: any[]; updatedTags?: any[]; updated_tags?: any[] }) =>
  api.post<InstagramGraphResponse>(`/integrations/instagram/media/${mediaId}/product-tags`, data);

export const listInstagramComments = (mediaId: string, params?: any) =>
  api.get<InstagramGraphResponse>(`/integrations/instagram/media/${mediaId}/comments`, { params });

export const createInstagramComment = (mediaId: string, data: { message?: string; text?: string }) =>
  api.post<InstagramGraphResponse>(`/integrations/instagram/media/${mediaId}/comments`, data);

export const getInstagramComment = (commentId: string, params?: any) =>
  api.get<InstagramGraphResponse>(`/integrations/instagram/comments/${commentId}`, { params });

export const replyToInstagramComment = (commentId: string, data: { message?: string; text?: string }) =>
  api.post<InstagramGraphResponse>(`/integrations/instagram/comments/${commentId}/replies`, data);

export const updateInstagramCommentVisibility = (commentId: string, data: { hidden: boolean }) =>
  api.post<InstagramGraphResponse>(`/integrations/instagram/comments/${commentId}/visibility`, data);

export const deleteInstagramComment = (commentId: string) =>
  api.delete<InstagramGraphResponse>(`/integrations/instagram/comments/${commentId}`);

export const listInstagramConversations = (params?: any) =>
  api.get<InstagramGraphResponse>('/integrations/instagram/conversations', { params });

export const listInstagramConversationMessages = (conversationId: string, params?: any) =>
  api.get<InstagramGraphResponse>(`/integrations/instagram/conversations/${conversationId}/messages`, { params });

export const getInstagramMessage = (messageId: string, params?: any) =>
  api.get<InstagramGraphResponse>(`/integrations/instagram/messages/${messageId}`, { params });

export const sendInstagramMessage = (data: {
  recipientId?: string;
  instagramUserId?: string;
  recipient?: any;
  text?: string;
  message?: any;
  senderAction?: string;
  messagingType?: string;
}) => api.post<InstagramGraphResponse>('/integrations/instagram/messages', data);

export const sendInstagramPrivateReply = (data: { commentId?: string; comment_id?: string; text?: string; message?: any }) =>
  api.post<InstagramGraphResponse>('/integrations/instagram/messages/private-reply', data);

export const getInstagramUserProfile = (userId: string, params?: any) =>
  api.get<InstagramGraphResponse>(`/integrations/instagram/user-profile/${userId}`, { params });

export const getInstagramAccountInsights = (params: { metric: string; period?: string; since?: string; until?: string; breakdown?: string }) =>
  api.get<InstagramGraphResponse>('/integrations/instagram/insights/account', { params });

export const getInstagramBusinessDiscovery = (username: string, params?: any) =>
  api.get<InstagramGraphResponse>(`/integrations/instagram/business-discovery/${username}`, { params });

export const searchInstagramHashtags = (params: { q?: string; query?: string }) =>
  api.get<InstagramGraphResponse>('/integrations/instagram/hashtags/search', { params });

export const listRecentlySearchedInstagramHashtags = (params?: any) =>
  api.get<InstagramGraphResponse>('/integrations/instagram/hashtags/recently-searched', { params });

export const listInstagramHashtagMedia = (hashtagId: string, edge: 'recent-media' | 'top-media', params?: any) =>
  api.get<InstagramGraphResponse>(`/integrations/instagram/hashtags/${hashtagId}/${edge}`, { params });

export const listInstagramCatalogs = (params?: any) =>
  api.get<InstagramGraphResponse>('/integrations/instagram/catalogs', { params });

export const searchInstagramCatalogProducts = (catalogId: string, params?: any) =>
  api.get<InstagramGraphResponse>(`/integrations/instagram/catalogs/${catalogId}/products`, { params });

export const getInstagramProductAppeal = (productId: string) =>
  api.get<InstagramGraphResponse>(`/integrations/instagram/products/${productId}/appeal`);

export const createInstagramProductAppeal = (productId: string, data: { appealReason?: string; appeal_reason?: string }) =>
  api.post<InstagramGraphResponse>(`/integrations/instagram/products/${productId}/appeal`, data);

export const listInstagramTags = (params?: any) =>
  api.get<InstagramGraphResponse>('/integrations/instagram/tags', { params });

export const listInstagramStories = (params?: any) =>
  api.get<InstagramGraphResponse>('/integrations/instagram/stories', { params });

export const listInstagramLiveMedia = (params?: any) =>
  api.get<InstagramGraphResponse>('/integrations/instagram/live-media', { params });

export const getInstagramMentionedComment = (commentId: string, params?: any) =>
  api.get<InstagramGraphResponse>(`/integrations/instagram/mentions/comments/${commentId}`, { params });

export const getInstagramMentionedMedia = (mediaId: string, params?: any) =>
  api.get<InstagramGraphResponse>(`/integrations/instagram/mentions/media/${mediaId}`, { params });

export const replyToInstagramMention = (data: { mediaId?: string; media_id?: string; commentId?: string; comment_id?: string; message?: string; text?: string }) =>
  api.post<InstagramGraphResponse>('/integrations/instagram/mentions/replies', data);

export const getInstagramOEmbed = (params: { url: string; maxwidth?: number; hidecaption?: boolean; omitscript?: boolean }) =>
  api.get<InstagramGraphResponse>('/integrations/instagram/oembed', { params });

export const getInstagramMessengerProfile = (params?: any) =>
  api.get<InstagramGraphResponse>('/integrations/instagram/messenger-profile', { params });

export const updateInstagramMessengerProfile = (data: any) =>
  api.post<InstagramGraphResponse>('/integrations/instagram/messenger-profile', data);

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
  instagramActorId?: string;
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
