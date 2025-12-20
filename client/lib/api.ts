function resolveApiUrl() {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl && envUrl.length) {
    const clean = envUrl.replace(/\/$/, '');
    // If the env var already contains /api/v1, use as-is, otherwise append
    return clean.endsWith('/api/v1') ? clean : `${clean}/api/v1`;
  }

  if (typeof window !== 'undefined' && window.location) {
    // Assume backend served from same origin under /api/v1 in absence of env var
    return `${window.location.origin}/api/v1`;
  }

  // Fallback for server-side or unknown environments
  return 'http://localhost:5001/api/v1';
}

const API_URL = resolveApiUrl();
console.log('🔗 Backend API connected to:', API_URL);

// Helper function to get token from localStorage
const getToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('token');
  }
  return null;
};

// Helper function to check if user is authenticated
const isAuthenticated = () => {
  if (typeof window !== 'undefined') {
    return !!localStorage.getItem('token');
  }
  return false;
};

// Helper function to get headers with authorization
const getAuthHeaders = () => {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

// Generic HTTP methods
export const get = async (endpoint: string) => {
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'GET',
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('token');
      throw new Error('Unauthorized');
    }
    const error = await response.json();
    throw new Error(error.message || 'Request failed');
  }

  return response.json();
};

export const post = async (endpoint: string, data: any) => {
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('token');
      throw new Error('Unauthorized');
    }
    const error = await response.json();
    throw new Error(error.message || 'Request failed');
  }

  return response.json();
};

export const put = async (endpoint: string, data: any) => {
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('token');
      throw new Error('Unauthorized');
    }
    const error = await response.json();
    throw new Error(error.message || 'Request failed');
  }

  return response.json();
};

export const del = async (endpoint: string) => {
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('token');
      throw new Error('Unauthorized');
    }
    const error = await response.json();
    throw new Error(error.message || 'Request failed');
  }

  return response.json();
};

// Export helper functions
export { getToken, isAuthenticated };

// OTP-based authentication functions
export const sendSignupOTP = async (userData) => {
  const response = await fetch(`${API_URL}/auth/send-signup-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(userData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to send OTP');
  }

  return response.json();
};

export const verifySignupOTP = async (otpData) => {
  const response = await fetch(`${API_URL}/auth/verify-signup-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(otpData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to verify OTP');
  }

  const data = await response.json();
  if (data.token) {
    localStorage.setItem('token', data.token);
  }
  return data;
};

export const sendLoginOTP = async (credentials) => {
  const response = await fetch(`${API_URL}/auth/send-login-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to send OTP');
  }

  return response.json();
};

export const verifyLoginOTP = async (otpData) => {
  const response = await fetch(`${API_URL}/auth/verify-login-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(otpData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to verify OTP');
  }

  const data = await response.json();
  if (data.token) {
    localStorage.setItem('token', data.token);
  }
  return data;
};

// Legacy functions (keeping for backward compatibility)
export const registerUser = async (userData) => {
  const response = await fetch(`${API_URL}/auth/signup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(userData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to register');
  }

  const data = await response.json();
  if (data.token) {
    localStorage.setItem('token', data.token);
  }
  return data;
};

export const loginUser = async (credentials) => {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to login');
  }

  const data = await response.json();
  if (data.token) {
    localStorage.setItem('token', data.token);
  }
  return data;
};

export const logoutUser = async () => {
  try {
    const response = await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to logout');
    }

    return response.json();
  } finally {
    localStorage.removeItem('token');
  }
};

export const getCurrentUser = async () => {
  const response = await fetch(`${API_URL}/auth/me`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('token');
      return null; // Not authenticated
    }
    const error = await response.json();
    throw new Error(error.message || 'Failed to get user');
  }

  const data = await response.json();
  return data.user; // Return the user object from the response
};

export const updateProfile = async (profileData) => {
  const response = await fetch(`${API_URL}/auth/update-profile`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(profileData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update profile');
  }

  const data = await response.json();
  return data.user; // Return the updated user object
};

// Google OAuth functions
export const googleLogin = async (token) => {
  const response = await fetch(`${API_URL}/auth/google/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Google authentication failed');
  }

  const data = await response.json();
  if (data.token) {
    localStorage.setItem('token', data.token);
  }
  return data;
};

export const getGoogleAuthUrl = async () => {
  const response = await fetch(`${API_URL}/auth/google/auth-url`, {
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get Google auth URL');
  }

  return response.json();
};

// Google OTP verification
export const verifyGoogleOTP = async (data) => {
  try {
    const response = await fetch(`${API_URL}/auth/google/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to verify Google OTP');
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
};

export const facebookLogin = async (accessToken: string) => {
  const response = await fetch(`${API_URL}/auth/facebook/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ accessToken }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Facebook authentication failed');
  }

  const data = await response.json();
  if (data.token) {
    localStorage.setItem('token', data.token);
  }
  return data;
};

// Email verification functions
export const sendEmailVerificationOTP = async () => {
  const response = await fetch(`${API_URL}/auth/send-email-verification`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to send verification email');
  }

  return response.json();
};

export const verifyEmailOTP = async (otp: string) => {
  const response = await fetch(`${API_URL}/auth/verify-email`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify({ otp }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to verify email');
  }

  return response.json();
};

// ===== CONTACTS API =====

// Upload contacts (bulk)
export const uploadContacts = async (contacts) => {
  const response = await fetch(`${API_URL}/contacts/upload`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify({ contacts }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to upload contacts');
  }
  return response.json();
};

// Fetch all contacts for the logged-in user
export const fetchContacts = async (page = 1, limit = 50, search = '') => {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    ...(search && { search })
  });
  
  const response = await fetch(`${API_URL}/contacts?${params}`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch contacts');
  }
  return response.json();
};

// Get contact statistics
export const getContactStats = async () => {
  const response = await fetch(`${API_URL}/contacts/stats`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch contact stats');
  }
  return response.json();
};

// Delete a contact
export const deleteContact = async (contactId) => {
  const response = await fetch(`${API_URL}/contacts/${contactId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete contact');
  }
  return response.json();
};

// ===== TEMPLATES API (Meta Integration) =====

// Get all templates with optional filters
export const fetchTemplates = async (params = {}) => {
  const queryString = new URLSearchParams(params).toString();
  const response = await fetch(`${API_URL}/templates${queryString ? '?' + queryString : ''}`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch templates');
  }

  return await response.json();
};

// Get single template by ID
export const fetchTemplate = async (templateId) => {
  const response = await fetch(`${API_URL}/templates/${templateId}`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch template');
  }

  return await response.json();
};

// Create new template
export const createTemplate = async (templateData) => {
  const response = await fetch(`${API_URL}/templates`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(templateData)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create template');
  }

  return await response.json();
};

// Update existing template
export const updateTemplate = async (templateId, updates) => {
  const response = await fetch(`${API_URL}/templates/${templateId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(updates)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update template');
  }

  return await response.json();
};

// Delete template
export const deleteTemplate = async (templateId) => {
  const response = await fetch(`${API_URL}/templates/${templateId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
    credentials: 'include'
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete template');
  }

  return await response.json();
};

// Submit template to Meta for approval
export const submitTemplateToMeta = async (templateId) => {
  const response = await fetch(`${API_URL}/templates/${templateId}/submit`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include'
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to submit template');
  }

  return await response.json();
};

// Sync templates from Meta (your own templates)
export const syncTemplatesFromMeta = async () => {
  const response = await fetch(`${API_URL}/templates/sync`, {
    method: 'GET',
    headers: getAuthHeaders(),
    credentials: 'include'
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to sync templates');
  }

  return await response.json();
};

// Get Template Library (pre-made templates from Meta)
export const getTemplateLibrary = async (category?: string) => {
  const params = new URLSearchParams();
  if (category) params.append('category', category);
  
  const response = await fetch(`${API_URL}/templates/library?${params}`, {
    headers: getAuthHeaders(),
    credentials: 'include'
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch template library');
  }

  return await response.json();
};

// Sync from Meta's Template Library API
export const syncTemplateLibrary = async (category?: string, language: string = 'en_US') => {
  const params = new URLSearchParams();
  if (category) params.append('category', category);
  params.append('language', language);
  
  const response = await fetch(`${API_URL}/templates/library/sync?${params}`, {
    method: 'GET',
    headers: getAuthHeaders(),
    credentials: 'include'
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to sync template library');
  }

  return await response.json();
};

// Copy a template from Meta's Template Library
export const copyFromTemplateLibrary = async (
  libraryTemplateName: string, 
  customName?: string,
  language: string = 'en_US',
  category: string = 'UTILITY',
  templateData?: {
    headerText?: string;
    bodyText?: string;
    footerText?: string;
    buttonLabels?: string[];
    variables?: string[];
    variableSamples?: Record<string, string>;
  }
) => {
  const response = await fetch(`${API_URL}/templates/library/copy`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify({ libraryTemplateName, customName, language, category, templateData })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to copy template from library');
  }

  return await response.json();
};

// Get template categories
export const getTemplateCategories = async () => {
  const response = await fetch(`${API_URL}/templates/categories`, {
    headers: getAuthHeaders(),
    credentials: 'include'
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch categories');
  }

  return await response.json();
};

// Get template library statistics
export const getTemplateLibraryStats = async () => {
  const response = await fetch(`${API_URL}/templates/stats`, {
    headers: getAuthHeaders(),
    credentials: 'include'
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch template stats');
  }

  return await response.json();
};

// Send template message
export const sendTemplateMessage = async (data) => {
  const response = await fetch(`${API_URL}/messages/template`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to send template message');
  }

  return await response.json();
};

// Send bulk template messages
export const sendBulkTemplateMessage = async (data) => {
  const response = await fetch(`${API_URL}/messages/bulk-template`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to send bulk template messages');
  }

  return await response.json();
};

// ===== SETTINGS API =====

// Get WABA settings
export const getWABASettings = async () => {
  const response = await fetch(`${API_URL}/settings/waba`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch WABA settings');
  }
  return response.json();
};

// Update WABA settings
export const updateWABASettings = async (settings) => {
  const response = await fetch(`${API_URL}/settings/waba`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(settings),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update WABA settings');
  }
  return response.json();
};

// Test WABA connection
export const testWABAConnection = async () => {
  const response = await fetch(`${API_URL}/settings/waba/test`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Connection test failed');
  }
  return response.json();
};

// Initialize WABA settings from environment variables (development only)
export const initializeWABAFromEnv = async () => {
  const response = await fetch(`${API_URL}/settings/waba/init-from-env`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to initialize WABA from environment');
  }
  return response.json();
};

// Debug WABA credentials - helps discover correct WABA ID
export const debugWABACredentials = async () => {
  const response = await fetch(`${API_URL}/settings/waba/debug`, {
    method: 'GET',
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to debug WABA credentials');
  }
  return response.json();
};

// ===== CONVERSATIONS API =====

// Get all conversations
export const fetchConversations = async (params: any = {}) => {
  const queryParams = new URLSearchParams();
  if (params.status) queryParams.append('status', params.status);
  if (params.assignedTo) queryParams.append('assignedTo', params.assignedTo);
  if (params.limit) queryParams.append('limit', params.limit);
  if (params.offset) queryParams.append('offset', params.offset);
  
  const response = await fetch(`${API_URL}/conversations?${queryParams}`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch conversations');
  }
  return response.json();
};

// Get conversation by contact
export const fetchConversationByContact = async (contactId) => {
  const response = await fetch(`${API_URL}/conversations/${contactId}`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch conversation');
  }
  return response.json();
};

// Get message thread
export const fetchMessageThread = async (contactId, params: any = {}) => {
  const queryParams = new URLSearchParams();
  if (params.limit) queryParams.append('limit', params.limit);
  if (params.offset) queryParams.append('offset', params.offset);
  
  const response = await fetch(`${API_URL}/conversations/${contactId}/messages?${queryParams}`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch messages');
  }
  return response.json();
};

// Update conversation
export const updateConversation = async (contactId, updates) => {
  const response = await fetch(`${API_URL}/conversations/${contactId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(updates),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update conversation');
  }
  return response.json();
};

// Mark conversation as read
export const markConversationAsRead = async (contactId) => {
  const response = await fetch(`${API_URL}/conversations/${contactId}/read`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to mark as read');
  }
  return response.json();
};

// ===== METRICS API =====

// Get template metrics
export const getTemplateMetrics = async (days = 30) => {
  const response = await fetch(`${API_URL}/metrics/templates?days=${days}`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch template metrics');
  }
  return response.json();
};

// Get message metrics
export const getMessageMetrics = async (days = 7) => {
  const response = await fetch(`${API_URL}/metrics/messages?days=${days}`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch message metrics');
  }
  return response.json();
};

// ===== CAMPAIGNS API =====

// Create a new campaign
export const createCampaign = async (campaignData) => {
  const response = await fetch(`${API_URL}/campaigns`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(campaignData),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create campaign');
  }
  return response.json();
};

// Get all campaigns
export const fetchCampaigns = async (status = '', page = 1, limit = 10) => {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    ...(status && { status })
  });
  
  const response = await fetch(`${API_URL}/campaigns?${params}`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch campaigns');
  }
  return response.json();
};

// Get a single campaign
export const fetchCampaign = async (campaignId) => {
  const response = await fetch(`${API_URL}/campaigns/${campaignId}`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch campaign');
  }
  return response.json();
};

// Start a campaign
export const startCampaign = async (campaignId, contactIds) => {
  const response = await fetch(`${API_URL}/campaigns/${campaignId}/start`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify({ contactIds }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to start campaign');
  }
  return response.json();
};

// Update a campaign
export const updateCampaign = async (campaignId, campaignData) => {
  const response = await fetch(`${API_URL}/campaigns/${campaignId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(campaignData),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update campaign');
  }
  return response.json();
};

// Delete a campaign
export const deleteCampaign = async (campaignId) => {
  const response = await fetch(`${API_URL}/campaigns/${campaignId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete campaign');
  }
  return response.json();
};

// Get campaign statistics
export const getCampaignStats = async () => {
  const response = await fetch(`${API_URL}/campaigns/stats`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch campaign stats');
  }
  return response.json();
};

// ===== TEMPLATES API (Meta Integration) =====

// Get all templates with optional filters
export const getTemplates = async (params = {}) => {
  const queryString = new URLSearchParams(params).toString();
  const response = await fetch(`${API_URL}/templates${queryString ? '?' + queryString : ''}`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch templates');
  }

  return await response.json();
};

// Get single template by ID
export const getTemplate = async (templateId) => {
  const response = await fetch(`${API_URL}/templates/${templateId}`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch template');
  }

  return await response.json();
};

// Create new template
export const createNewTemplate = async (templateData) => {
  const response = await fetch(`${API_URL}/templates`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(templateData)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create template');
  }

  return await response.json();
};

// Update existing template
export const updateExistingTemplate = async (templateId, updates) => {
  const response = await fetch(`${API_URL}/templates/${templateId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(updates)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update template');
  }

  return await response.json();
};

// Delete template
export const deleteExistingTemplate = async (templateId) => {
  const response = await fetch(`${API_URL}/templates/${templateId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
    credentials: 'include'
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete template');
  }

  return await response.json();
};

// ===== ONBOARDING API =====

// Get onboarding status
export const getOnboardingStatus = async () => {
  const response = await fetch(`${API_URL}/onboarding/status`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch onboarding status');
  }
  return response.json();
};

// Get verification status (fetches real status from Meta)
export const getVerificationStatus = async () => {
  const response = await fetch(`${API_URL}/onboarding/verification-status`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch verification status');
  }
  return response.json();
};

// Save business info
export const saveBusinessInfo = async (businessInfo) => {
  const response = await fetch(`${API_URL}/onboarding/business-info`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(businessInfo),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to save business info');
  }
  return response.json();
};

// Connect WhatsApp number
export const connectWhatsApp = async (data) => {
  // Manual connect is deprecated. Use ESB embedded signup instead.
  // Forward the call to ESB start endpoint.
  return await esbStart();
};

// Complete onboarding
export const completeOnboarding = async () => {
  const response = await fetch(`${API_URL}/onboarding/complete`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to complete onboarding');
  }
  return response.json();
};

// ===== ESB (Embedded Signup) API =====

// Start ESB flow (returns ESB URL and state)
export const esbStart = async () => {
  const response = await fetch(`${API_URL}/onboarding/esb/start`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include'
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to start ESB flow');
  }
  return response.json();
};

// Get ESB status
export const esbStatus = async () => {
  const response = await fetch(`${API_URL}/onboarding/esb/status`, {
    headers: getAuthHeaders(),
    credentials: 'include'
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch ESB status');
  }
  return response.json();
};

// Register phone + send OTP (ESB)
export const esbRegisterPhone = async (phoneNumber) => {
  const response = await fetch(`${API_URL}/onboarding/esb/register-phone`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify({ phoneNumber })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to register phone');
  }
  return response.json();
};

// Verify phone OTP (ESB)
export const esbVerifyOTP = async (otpCode) => {
  const response = await fetch(`${API_URL}/onboarding/esb/verify-otp`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify({ otpCode })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to verify OTP');
  }
  return response.json();
};

// Create system user and token (ESB)
export const esbCreateSystemUser = async () => {
  const response = await fetch(`${API_URL}/onboarding/esb/create-system-user`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include'
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create system user');
  }
  return response.json();
};

// Activate WABA (ESB)
export const esbActivateWABA = async (payload = {}) => {
  const response = await fetch(`${API_URL}/onboarding/esb/activate-waba`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to activate WABA');
  }
  return response.json();
};

// Process ESB callback (exchange code for token)
export const processEsbCallback = async (payload) => {
  const response = await fetch(`${API_URL}/onboarding/esb/process-callback`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to process callback');
  }
  return response.json();
};