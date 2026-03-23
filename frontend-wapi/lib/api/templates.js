import { API_URL, get, post, put, del, getAuthHeaders, getToken } from './client';

const TEMPLATE_SYNC_MIN_INTERVAL_MS = 45 * 1000;
let templateSyncInFlight = null;
let templateSyncLastRunAt = 0;
let templateCreationInFlight = null;

export const fetchTemplates = async (params = {}) => {
  const queryString = new URLSearchParams(params).toString();
  return get(`/templates${queryString ? '?' + queryString : ''}`);
};

export const fetchTemplate = async (templateId) => {
  return get(`/templates/${templateId}`);
};

export const createTemplate = async (templateData) => {
  if (templateCreationInFlight) {
    return templateCreationInFlight;
  }
  templateCreationInFlight = (async () => {
    try {
      return await post('/templates', templateData);
    } finally {
      templateCreationInFlight = null;
    }
  })();
  return templateCreationInFlight;
};

export const updateTemplate = async (templateId, updates) => {
  return put(`/templates/${templateId}`, updates);
};

export const deleteTemplate = async (templateId) => {
  return del(`/templates/${templateId}`);
};

export const uploadTemplateMedia = async (file) => {
  const token = getToken();
  const formData = new FormData();
  formData.append('file', file);
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const response = await fetch(`${API_URL}/templates/upload-media`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: formData
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to upload template media');
  }
  return await response.json();
};

export const submitTemplateToGupshup = async (templateId) => {
  return post(`/templates/${templateId}/submit`, {});
};

export const syncTemplatesFromGupshup = async (options = {}) => {
  const force = Boolean(options.force);
  const now = Date.now();
  if (!force && templateSyncInFlight) return templateSyncInFlight;
  if (!force && now - templateSyncLastRunAt < TEMPLATE_SYNC_MIN_INTERVAL_MS) {
    return { success: true, skipped: true, reason: 'CLIENT_SYNC_THROTTLED' };
  }
  templateSyncInFlight = (async () => {
    try {
      const result = await get('/templates/sync');
      templateSyncLastRunAt = Date.now();
      return result;
    } finally {
      templateSyncInFlight = null;
    }
  })();
  return templateSyncInFlight;
};

// Aliases
export const getTemplates = fetchTemplates;
export const getTemplate = fetchTemplate;
export const createNewTemplate = createTemplate;
export const updateExistingTemplate = updateTemplate;
export const deleteExistingTemplate = deleteTemplate;
export const submitTemplateToMeta = submitTemplateToGupshup;
export const syncTemplatesFromMeta = syncTemplatesFromGupshup;

export const getTemplateCategories = async () => get('/templates/categories');
export const duplicateTemplate = async (templateId, newName) => post(`/templates/${templateId}/duplicate`, { newName });
export const validateTemplate = async (templateData) => post('/templates/validate', templateData);

let _templateStatsCache = null;
let _templateStatsFetchedAt = 0;
const TEMPLATE_STATS_TTL = 5 * 60 * 1000;

export const getTemplateLibraryStats = async () => {
  const now = Date.now();
  if (_templateStatsCache && (now - _templateStatsFetchedAt) < TEMPLATE_STATS_TTL) return _templateStatsCache;
  const data = await get('/templates/stats');
  _templateStatsCache = data;
  _templateStatsFetchedAt = Date.now();
  return data;
};

export const fetchTemplatesFromLibrary = async (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return get(`/templates/library${query ? '?' + query : ''}`);
};

export const createTemplateFromLibrary = async (payload) => post('/templates/library', payload);
export const markTemplateReviewed = async (templateId, notes) => put(`/admin/templates/${templateId}/status`, { status: 'approved', rejectionReason: notes });
