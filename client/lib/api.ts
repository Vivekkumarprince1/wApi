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

// Convenience wrapper for account deletion
export const deleteAccount = async () => {
  return del('/privacy/delete-account');
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

// Duplicate a template
export const duplicateTemplate = async (templateId: string, newName?: string) => {
  const response = await fetch(`${API_URL}/templates/${templateId}/duplicate`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify({ newName })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to duplicate template');
  }

  return await response.json();
};

// Validate template (preview validation without saving)
export const validateTemplate = async (templateData: any) => {
  const response = await fetch(`${API_URL}/templates/validate`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(templateData)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to validate template');
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

// Process ESB callback (code + state) - Legacy method
export const esbProcessCallback = async (code: string, state: string) => {
  const response = await fetch(`${API_URL}/onboarding/esb/process-callback`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify({ code, state })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to process ESB callback');
  }
  return response.json();
};

// Process stored callback (new method - triggered after redirect)
export const esbProcessStoredCallback = async () => {
  const response = await fetch(`${API_URL}/onboarding/esb/process-stored-callback`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to process stored callback');
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

// Process PARTNER_ADDED webhook event (Steps 4-6 of Meta ESB flow)
// This retrieves business token and customer phone number after webhook is received
export const esbProcessPartnerAdded = async () => {
  const response = await fetch(`${API_URL}/onboarding/esb/process-partner-added`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include'
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to process PARTNER_ADDED event');
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

// ============================================================
// ✅ WHATSAPP ADS API (Click-to-Chat)
// ============================================================

/**
 * Check if workspace can create ads (prerequisites & plan)
 */
export const checkAdsEligibility = async () => {
  return get('/ads/check-eligibility');
};

/**
 * Create new ad campaign
 */
export const createAd = async (adData: any) => {
  return post('/ads', adData);
};

/**
 * List all ads for workspace
 */
export const listAds = async (status?: string, page = 1, limit = 20) => {
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  
  return get(`/ads?${params.toString()}`);
};

/**
 * Get single ad details
 */
export const getAd = async (adId: string) => {
  return get(`/ads/${adId}`);
};

/**
 * Update ad (only draft status)
 */
export const updateAd = async (adId: string, updates: any) => {
  return put(`/ads/${adId}`, updates);
};

/**
 * Pause ad
 */
export const pauseAd = async (adId: string, reason?: string) => {
  return post(`/ads/${adId}/pause`, { reason });
};

/**
 * Resume paused ad
 */
export const resumeAd = async (adId: string) => {
  return post(`/ads/${adId}/resume`, {});
};

/**
 * Delete ad
 */
export const deleteAd = async (adId: string) => {
  return fetch(`${API_URL}/ads/${adId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
    credentials: 'include'
  }).then(async (response) => {
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete ad');
    }
    return response.json();
  });
};

/**
 * Get ad analytics/performance
 */
export const getAdAnalytics = async (adId: string) => {
  return get(`/ads/${adId}/analytics`);
};

// ========================
// WORKFLOW AUTOMATION APIs
// ========================

/**
 * Get all workflows
 */
export const getWorkflows = async (filters?: any) => {
  let endpoint = '/automation';
  if (filters) {
    const params = new URLSearchParams();
    if (filters.enabled !== undefined) params.append('enabled', filters.enabled);
    if (filters.trigger) params.append('trigger', filters.trigger);
    if (filters.search) params.append('search', filters.search);
    const queryString = params.toString();
    endpoint = queryString ? `/automation?${queryString}` : '/automation';
  }
  return get(endpoint);
};

/**
 * Get single workflow by ID
 */
export const getWorkflow = async (workflowId: string) => {
  return get(`/automation/${workflowId}`);
};

/**
 * Create new workflow
 */
export const createWorkflow = async (workflowData: any) => {
  return post('/automation', workflowData);
};

/**
 * Update existing workflow
 */
export const updateWorkflow = async (workflowId: string, workflowData: any) => {
  return put(`/automation/${workflowId}`, workflowData);
};

/**
 * Toggle workflow enabled/disabled status
 */
export const toggleWorkflow = async (workflowId: string) => {
  return post(`/automation/${workflowId}/toggle`, {});
};

/**
 * Delete workflow
 */
export const deleteWorkflow = async (workflowId: string) => {
  return fetch(`${API_URL}/automation/${workflowId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
    credentials: 'include'
  }).then(async (response) => {
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete workflow');
    }
    return response.json();
  });
};

/**
 * Get workflow executions/history
 */
export const getWorkflowExecutions = async (workflowId: string, filters?: any) => {
  let endpoint = `/automation/${workflowId}/executions`;
  if (filters) {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.offset) params.append('offset', filters.offset);
    const queryString = params.toString();
    endpoint = queryString ? `${endpoint}?${queryString}` : endpoint;
  }
  return get(endpoint);
};

/**
 * Get workflow analytics/stats
 */
export const getWorkflowAnalytics = async (dateRange?: any) => {
  let endpoint = '/automation/analytics';
  if (dateRange) {
    const params = new URLSearchParams();
    if (dateRange.startDate) params.append('startDate', dateRange.startDate);
    if (dateRange.endDate) params.append('endDate', dateRange.endDate);
    const queryString = params.toString();
    endpoint = queryString ? `${endpoint}?${queryString}` : endpoint;
  }
  return get(endpoint);
};

// ============================================================================
// Auto-Replies API Functions
// ============================================================================

/**
 * Get all auto-replies with optional filters
 */
export const getAutoReplies = async (filters?: any) => {
  let endpoint = '/auto-replies';
  if (filters) {
    const params = new URLSearchParams();
    if (filters.enabled !== undefined && filters.enabled !== 'all') {
      params.append('enabled', filters.enabled);
    }
    if (filters.template) params.append('template', filters.template);
    if (filters.search) params.append('search', filters.search);
    const queryString = params.toString();
    endpoint = queryString ? `${endpoint}?${queryString}` : endpoint;
  }
  return get(endpoint);
};

/**
 * Get single auto-reply by ID
 */
export const getAutoReply = async (autoReplyId: string) => {
  return get(`/auto-replies/${autoReplyId}`);
};

/**
 * Create new auto-reply
 */
export const createAutoReply = async (autoReplyData: any) => {
  return post('/auto-replies', autoReplyData);
};

/**
 * Update existing auto-reply
 */
export const updateAutoReply = async (autoReplyId: string, autoReplyData: any) => {
  return put(`/auto-replies/${autoReplyId}`, autoReplyData);
};

/**
 * Toggle auto-reply enabled/disabled status
 */
export const toggleAutoReply = async (autoReplyId: string) => {
  return post(`/auto-replies/${autoReplyId}/toggle`, {});
};

/**
 * Delete auto-reply
 */
export const deleteAutoReply = async (autoReplyId: string) => {
  return fetch(`${API_URL}/auto-replies/${autoReplyId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
    credentials: 'include'
  }).then(async (response) => {
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete auto-reply');
    }
    return response.json();
  });
};

/**
 * Get all Instagram quickflows with filters
 */
export const getInstagramQuickflows = async (filters?: any) => {
  const params = new URLSearchParams();
  if (filters) {
    if (filters.enabled) params.append('enabled', filters.enabled);
    if (filters.type) params.append('type', filters.type);
    if (filters.triggerType) params.append('triggerType', filters.triggerType);
  }
  const query = params.toString();
  return get(`/instagram-quickflows${query ? '?' + query : ''}`);
};

/**
 * Get preset Instagram quickflows
 */
export const getPresetInstagramQuickflows = async () => {
  return get('/instagram-quickflows/presets');
};

/**
 * Get single Instagram quickflow by ID
 */
export const getInstagramQuickflow = async (quickflowId: string) => {
  return get(`/instagram-quickflows/${quickflowId}`);
};

/**
 * Create new Instagram quickflow
 */
export const createInstagramQuickflow = async (quickflowData: any) => {
  return post('/instagram-quickflows', quickflowData);
};

/**
 * Create Instagram quickflow from preset
 */
export const createInstagramQuickflowFromPreset = async (presetName: string, customization?: any) => {
  return post('/instagram-quickflows/preset/create', {
    preset: presetName,
    customization: customization || {}
  });
};

/**
 * Update existing Instagram quickflow
 */
export const updateInstagramQuickflow = async (quickflowId: string, quickflowData: any) => {
  return put(`/instagram-quickflows/${quickflowId}`, quickflowData);
};

/**
 * Toggle Instagram quickflow enabled/disabled status
 */
export const toggleInstagramQuickflow = async (quickflowId: string) => {
  return post(`/instagram-quickflows/${quickflowId}/toggle`, {});
};

/**
 * Get Instagram quickflow statistics
 */
export const getInstagramQuickflowStats = async (quickflowId: string) => {
  return get(`/instagram-quickflows/${quickflowId}/stats`);
};

/**
 * Delete Instagram quickflow
 */
export const deleteInstagramQuickflow = async (quickflowId: string) => {
  return fetch(`${API_URL}/instagram-quickflows/${quickflowId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
    credentials: 'include'
  }).then(async (response) => {
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete Instagram quickflow');
    }
    return response.json();
  });
};

// ==================== WhatsApp Forms API ====================

/**
 * Get all WhatsApp forms with optional filters
 */
export const getWhatsAppForms = async (filters?: { status?: string; search?: string }) => {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.search) params.append('search', filters.search);
  return get(`/whatsapp-forms${params.toString() ? '?' + params.toString() : ''}`);
};

/**
 * Get single WhatsApp form by ID
 */
export const getWhatsAppForm = async (formId: string) => {
  return get(`/whatsapp-forms/${formId}`);
};

/**
 * Create new WhatsApp form
 */
export const createWhatsAppForm = async (formData: any) => {
  return post('/whatsapp-forms', formData);
};

/**
 * Update existing WhatsApp form
 */
export const updateWhatsAppForm = async (formId: string, formData: any) => {
  return put(`/whatsapp-forms/${formId}`, formData);
};

/**
 * Publish WhatsApp form
 */
export const publishWhatsAppForm = async (formId: string) => {
  return post(`/whatsapp-forms/${formId}/publish`, {});
};

/**
 * Unpublish WhatsApp form
 */
export const unpublishWhatsAppForm = async (formId: string) => {
  return post(`/whatsapp-forms/${formId}/unpublish`, {});
};

/**
 * Delete WhatsApp form
 */
export const deleteWhatsAppForm = async (formId: string) => {
  return fetch(`${API_URL}/whatsapp-forms/${formId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
    credentials: 'include'
  }).then(async (response) => {
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete WhatsApp form');
    }
    return response.json();
  });
};

/**
 * Get WhatsApp form responses
 */
export const getWhatsAppFormResponses = async (formId: string, filters?: { status?: string; limit?: number; page?: number }) => {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.limit) params.append('limit', filters.limit.toString());
  if (filters?.page) params.append('page', filters.page.toString());
  return get(`/whatsapp-forms/${formId}/responses${params.toString() ? '?' + params.toString() : ''}`);
};

/**
 * Get WhatsApp form statistics
 */
export const getWhatsAppFormStats = async (formId: string) => {
  return get(`/whatsapp-forms/${formId}/stats`);
};

/**
 * Sync and recalculate WhatsApp form data
 */
export const syncWhatsAppFormData = async (formId: string) => {
  return post(`/whatsapp-forms/${formId}/sync`, {});
};

/**
 * Start new WhatsApp form response session
 */
export const startWhatsAppFormSession = async (formId: string, userPhone: string) => {
  return post('/whatsapp-forms/start', {
    formId,
    userPhone
  });
};

/**
 * Submit answer to WhatsApp form question
 */
export const submitWhatsAppFormAnswer = async (responseId: string, questionId: string, answer: string) => {
  return post('/whatsapp-forms/answer', {
    responseId,
    questionId,
    answer
  });
};

/**
 * AnswerBot API Functions
 */

/**
 * Generate FAQs from website URL
 */
export const generateAnswerBotFAQs = async (workspaceId: string, websiteUrl: string) => {
  return post(`/automation/answerbot/${workspaceId}/generate`, {
    websiteUrl
  });
};

/**
 * Get all FAQs for workspace
 */
export const getAnswerBotFAQs = async (workspaceId: string, filters?: { status?: string; source?: string; limit?: number; skip?: number }) => {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.source) params.append('source', filters.source);
  if (filters?.limit) params.append('limit', filters.limit.toString());
  if (filters?.skip) params.append('skip', filters.skip.toString());
  return get(`/automation/answerbot/${workspaceId}/faqs${params.toString() ? '?' + params.toString() : ''}`);
};

/**
 * Approve FAQs for use in auto-replies
 */
export const approveAnswerBotFAQs = async (workspaceId: string, faqIds: string[]) => {
  return post(`/automation/answerbot/${workspaceId}/approve`, {
    faqIds
  });
};

/**
 * Delete a FAQ
 */
export const deleteAnswerBotFAQ = async (workspaceId: string, faqId: string) => {
  return fetch(`${API_URL}/automation/answerbot/${workspaceId}/faqs/${faqId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
    credentials: 'include'
  }).then(async (response) => {
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete FAQ');
    }
    return response.json();
  });
};

/**
 * Get AnswerBot sources (crawled websites)
 */
export const getAnswerBotSources = async (workspaceId: string) => {
  return get(`/automation/answerbot/${workspaceId}/sources`);
};

// ============================================================
// SALES CRM - PIPELINE ENDPOINTS
// ============================================================

/**
 * Create a new sales pipeline
 */
export const createPipeline = async (data: {
  name: string;
  description?: string;
  stages: Array<{ id: string; title: string; isFinal?: boolean; color?: string }>;
  isDefault?: boolean;
}) => {
  return post(`/sales/pipelines`, data);
};

/**
 * Get all pipelines for workspace
 */
export const getPipelines = async () => {
  return get(`/sales/pipelines`);
};

/**
 * Get default pipeline (auto-creates if not exists)
 */
export const getDefaultPipeline = async () => {
  return get(`/sales/pipelines/default/pipeline`);
};

/**
 * Get single pipeline
 */
export const getPipeline = async (pipelineId: string) => {
  return get(`/sales/pipelines/${pipelineId}`);
};

/**
 * Update pipeline
 */
export const updatePipeline = async (pipelineId: string, data: any) => {
  return put(`/sales/pipelines/${pipelineId}`, data);
};

/**
 * Delete pipeline
 */
export const deletePipeline = async (pipelineId: string) => {
  return del(`/sales/pipelines/${pipelineId}`);
};

// ============================================================
// SALES CRM - DEAL ENDPOINTS
// ============================================================

/**
 * Create a new deal (add contact to pipeline)
 */
export const createDeal = async (data: {
  contactId: string;
  pipelineId: string;
  title: string;
  description?: string;
  value?: number;
  currency?: string;
}) => {
  return post(`/sales/deals`, data);
};

/**
 * Get all deals with optional filtering
 */
export const listDeals = async (filters?: {
  page?: number;
  limit?: number;
  stage?: string;
  pipelineId?: string;
  status?: string;
  assignedAgent?: string;
  search?: string;
}) => {
  const params = new URLSearchParams();
  if (filters?.page) params.append('page', filters.page.toString());
  if (filters?.limit) params.append('limit', filters.limit.toString());
  if (filters?.stage) params.append('stage', filters.stage);
  if (filters?.pipelineId) params.append('pipelineId', filters.pipelineId);
  if (filters?.status) params.append('status', filters.status);
  if (filters?.assignedAgent) params.append('assignedAgent', filters.assignedAgent);
  if (filters?.search) params.append('search', filters.search);
  
  return get(`/sales/deals${params.toString() ? '?' + params.toString() : ''}`);
};

/**
 * Get single deal
 */
export const getDeal = async (dealId: string) => {
  return get(`/sales/deals/${dealId}`);
};

/**
 * Get deals for a contact
 */
export const getDealsByContact = async (contactId: string) => {
  return get(`/sales/deals/contact/${contactId}`);
};

/**
 * Get deals grouped by stage for a pipeline
 */
export const getDealsByStage = async (pipelineId: string) => {
  return get(`/sales/deals/pipeline/${pipelineId}/stages`);
};

/**
 * Move deal to different stage
 */
export const moveDealStage = async (dealId: string, stageId: string) => {
  return post(`/sales/deals/${dealId}/move`, { stageId });
};

/**
 * Update deal details
 */
export const updateDeal = async (dealId: string, data: {
  title?: string;
  description?: string;
  value?: number;
  currency?: string;
  assignedAgent?: string;
}) => {
  return put(`/sales/deals/${dealId}`, data);
};

/**
 * Add note to deal
 */
export const addDealNote = async (dealId: string, text: string) => {
  return post(`/sales/deals/${dealId}/notes`, { text });
};

/**
 * Delete deal
 */
export const deleteDeal = async (dealId: string) => {
  return del(`/sales/deals/${dealId}`);
};
// ==================== SALES REPORTS ====================

/**
 * Get pipeline performance report
 * @param filters - { pipelineId?, startDate?, endDate? }
 */
export const getPipelinePerformanceReport = async (filters?: {
  pipelineId?: string;
  startDate?: string;
  endDate?: string;
}) => {
  const params = new URLSearchParams();
  if (filters?.pipelineId) params.append('pipelineId', filters.pipelineId);
  if (filters?.startDate) params.append('startDate', filters.startDate);
  if (filters?.endDate) params.append('endDate', filters.endDate);
  
  const queryString = params.toString();
  return get(`/sales/reports/pipeline-performance${queryString ? `?${queryString}` : ''}`);
};

/**
 * Get funnel report for a specific pipeline
 * @param pipelineId - Required
 * @param filters - { startDate?, endDate? }
 */
export const getFunnelReport = async (pipelineId: string, filters?: {
  startDate?: string;
  endDate?: string;
}) => {
  const params = new URLSearchParams({ pipelineId });
  if (filters?.startDate) params.append('startDate', filters.startDate);
  if (filters?.endDate) params.append('endDate', filters.endDate);
  
  return get(`/sales/reports/funnel?${params.toString()}`);
};

/**
 * Get agent performance report
 * @param filters - { agentId?, startDate?, endDate? }
 */
export const getAgentPerformanceReport = async (filters?: {
  agentId?: string;
  startDate?: string;
  endDate?: string;
}) => {
  const params = new URLSearchParams();
  if (filters?.agentId) params.append('agentId', filters.agentId);
  if (filters?.startDate) params.append('startDate', filters.startDate);
  if (filters?.endDate) params.append('endDate', filters.endDate);
  
  const queryString = params.toString();
  return get(`/sales/reports/agent-performance${queryString ? `?${queryString}` : ''}`);
};

/**
 * Get deal velocity report (time to close)
 * @param filters - { pipelineId?, startDate?, endDate? }
 */
export const getDealVelocityReport = async (filters?: {
  pipelineId?: string;
  startDate?: string;
  endDate?: string;
}) => {
  const params = new URLSearchParams();
  if (filters?.pipelineId) params.append('pipelineId', filters.pipelineId);
  if (filters?.startDate) params.append('startDate', filters.startDate);
  if (filters?.endDate) params.append('endDate', filters.endDate);
  
  const queryString = params.toString();
  return get(`/sales/reports/deal-velocity${queryString ? `?${queryString}` : ''}`);
};

/**
 * Get stage duration report (time spent per stage)
 * @param pipelineId - Required
 * @param filters - { startDate?, endDate? }
 */
export const getStageDurationReport = async (pipelineId: string, filters?: {
  startDate?: string;
  endDate?: string;
}) => {
  const params = new URLSearchParams({ pipelineId });
  if (filters?.startDate) params.append('startDate', filters.startDate);
  if (filters?.endDate) params.append('endDate', filters.endDate);
  
  return get(`/sales/reports/stage-duration?${params.toString()}`);
};

// ===== COMMERCE SETTINGS API =====

/**
 * Get Commerce Settings for current workspace
 * Returns all commerce configuration including payment methods, shipping, taxes
 */
export const getCommerceSettings = async () => {
  const response = await fetch(`${API_URL}/settings/commerce`, {
    method: 'GET',
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch commerce settings');
  }
  return response.json();
};

/**
 * Update Commerce Settings for current workspace
 * Requires plan permission (premium or enterprise)
 */
export const updateCommerceSettings = async (settings) => {
  const response = await fetch(`${API_URL}/settings/commerce`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(settings),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update commerce settings');
  }
  return response.json();
};

/**
 * Validate Commerce Configuration
 * Checks if all required fields are properly configured
 * Returns validation report and issues
 */
export const validateCommerceConfig = async () => {
  const response = await fetch(`${API_URL}/settings/commerce/validate`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to validate commerce config');
  }
  return response.json();
};

// ============================================================
// INTEGRATIONS API
// ============================================================

/**
 * Get all integrations for workspace
 */
export const getIntegrations = async (filters?: { type?: string; status?: string }) => {
  const params = new URLSearchParams();
  if (filters?.type) params.append('type', filters.type);
  if (filters?.status) params.append('status', filters.status);

  const response = await fetch(`${API_URL}/integrations${params.toString() ? '?' + params.toString() : ''}`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch integrations');
  }

  return response.json();
};

/**
 * Get single integration details
 */
export const getIntegration = async (integrationId: string) => {
  const response = await fetch(`${API_URL}/integrations/${integrationId}`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch integration');
  }

  return response.json();
};

/**
 * Create new integration
 */
export const createIntegration = async (integrationData: any) => {
  const response = await fetch(`${API_URL}/integrations`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(integrationData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create integration');
  }

  return response.json();
};

/**
 * Update integration
 */
export const updateIntegration = async (integrationId: string, updates: any) => {
  const response = await fetch(`${API_URL}/integrations/${integrationId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update integration');
  }

  return response.json();
};

/**
 * Delete integration
 */
export const deleteIntegration = async (integrationId: string) => {
  const response = await fetch(`${API_URL}/integrations/${integrationId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete integration');
  }

  return response.json();
};

// ============================================================
// WIDGET API
// ============================================================

/**
 * Get widget configuration
 */
export const getWidgetConfig = async () => {
  const response = await fetch(`${API_URL}/widget/config`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch widget config');
  }

  return response.json();
};

/**
 * Update widget configuration
 */
export const updateWidgetConfig = async (config: any) => {
  const response = await fetch(`${API_URL}/widget/config`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update widget config');
  }

  return response.json();
};

/**
 * Enable widget
 */
export const enableWidget = async () => {
  const response = await fetch(`${API_URL}/widget/enable`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to enable widget');
  }

  return response.json();
};

/**
 * Disable widget
 */
export const disableWidget = async () => {
  const response = await fetch(`${API_URL}/widget/disable`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to disable widget');
  }

  return response.json();
};

/**
 * Get widget analytics
 */
export const getWidgetAnalytics = async (filters?: { days?: number; startDate?: string; endDate?: string }) => {
  const params = new URLSearchParams();
  if (filters?.days) params.append('days', filters.days.toString());
  if (filters?.startDate) params.append('startDate', filters.startDate);
  if (filters?.endDate) params.append('endDate', filters.endDate);

  const response = await fetch(`${API_URL}/widget/analytics${params.toString() ? '?' + params.toString() : ''}`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch widget analytics');
  }

  return response.json();
};

// ============================================================
// ADMIN DASHBOARD API
// ============================================================

/**
 * Get all workspaces/tenants with pagination
 */
export const getAllWorkspaces = async (filters?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  plan?: string;
}) => {
  const params = new URLSearchParams();
  if (filters?.page) params.append('page', filters.page.toString());
  if (filters?.limit) params.append('limit', filters.limit.toString());
  if (filters?.search) params.append('search', filters.search);
  if (filters?.status) params.append('status', filters.status);
  if (filters?.plan) params.append('plan', filters.plan);

  const response = await fetch(`${API_URL}/admin/workspaces${params.toString() ? '?' + params.toString() : ''}`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch workspaces');
  }

  return response.json();
};

/**
 * Get workspace details with full information
 */
export const getWorkspaceDetails = async (workspaceId: string) => {
  const response = await fetch(`${API_URL}/admin/workspaces/${workspaceId}`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch workspace details');
  }

  return response.json();
};

/**
 * Suspend workspace
 */
export const suspendWorkspace = async (workspaceId: string, reason: string) => {
  const response = await fetch(`${API_URL}/admin/workspaces/${workspaceId}/suspend`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify({ reason }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to suspend workspace');
  }

  return response.json();
};

/**
 * Resume suspended workspace
 */
export const resumeWorkspace = async (workspaceId: string) => {
  const response = await fetch(`${API_URL}/admin/workspaces/${workspaceId}/resume`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to resume workspace');
  }

  return response.json();
};

/**
 * Get WABA health status for all workspaces
 */
export const getWABAHealth = async (filters?: { status?: string }) => {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);

  const response = await fetch(`${API_URL}/admin/waba-health${params.toString() ? '?' + params.toString() : ''}`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch WABA health');
  }

  return response.json();
};

/**
 * Get admin analytics (overview, usage, spending)
 */
export const getAdminAnalytics = async (filters?: {
  startDate?: string;
  endDate?: string;
  metric?: string;
}) => {
  const params = new URLSearchParams();
  if (filters?.startDate) params.append('startDate', filters.startDate);
  if (filters?.endDate) params.append('endDate', filters.endDate);
  if (filters?.metric) params.append('metric', filters.metric);

  const response = await fetch(`${API_URL}/admin/analytics${params.toString() ? '?' + params.toString() : ''}`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch analytics');
  }

  return response.json();
};

/**
 * Get templates pending approval
 */
export const getTemplatesForApproval = async (filters?: {
  page?: number;
  limit?: number;
  status?: string;
}) => {
  const params = new URLSearchParams();
  if (filters?.page) params.append('page', filters.page.toString());
  if (filters?.limit) params.append('limit', filters.limit.toString());
  if (filters?.status) params.append('status', filters.status);

  const response = await fetch(`${API_URL}/admin/templates/approval${params.toString() ? '?' + params.toString() : ''}`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch templates');
  }

  return response.json();
};

/**
 * Update template approval status
 */
export const updateTemplateApprovalStatus = async (
  templateId: string,
  status: 'approved' | 'rejected',
  rejectionReason?: string
) => {
  const response = await fetch(`${API_URL}/admin/templates/${templateId}/status`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify({ status, rejectionReason }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update template status');
  }

  return response.json();
};

/**
 * Get campaign analytics for all workspaces
 */
export const getCampaignAnalytics = async () => {
  const response = await fetch(`${API_URL}/admin/campaigns/analytics`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch campaign analytics');
  }

  return response.json();
};