/**
 * LIMITS AND QUOTAS
 * Centralized configuration for rate limits, quotas, and system limits
 */

const RATE_LIMITS = {
  // API Rate Limits
  GLOBAL: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200 // requests per window
  },

  // Auth endpoints
  AUTH: {
    windowMs: 15 * 60 * 1000,
    max: 10
  },

  // BSP operations (Gupshup, etc.)
  BSP: {
    windowMs: 60 * 1000, // 1 minute
    max: 50
  },

  // Workspace-specific
  WORKSPACE: {
    windowMs: 60 * 1000,
    max: 100
  },

  // Message sending
  MESSAGING: {
    windowMs: 60 * 1000,
    max: 30
  }
};

const QUOTAS = {
  // Template limits
  TEMPLATES: {
    FREE: 10,
    PRO: 100,
    ENTERPRISE: 1000
  },

  // Contact limits
  CONTACTS: {
    FREE: 1000,
    PRO: 10000,
    ENTERPRISE: 100000
  },

  // Message limits (per month)
  MESSAGES: {
    FREE: 1000,
    PRO: 10000,
    ENTERPRISE: 100000
  },

  // Campaign limits
  CAMPAIGNS: {
    FREE: 5,
    PRO: 50,
    ENTERPRISE: 500
  }
};

const SYSTEM_LIMITS = {
  // File upload limits
  FILE_SIZE: {
    IMAGE: 5 * 1024 * 1024, // 5MB
    DOCUMENT: 10 * 1024 * 1024, // 10MB
    AUDIO: 16 * 1024 * 1024 // 16MB
  },

  // Text limits
  TEXT: {
    MESSAGE: 4096, // WhatsApp message limit
    TEMPLATE_NAME: 512,
    TEMPLATE_BODY: 1024,
    CONTACT_NAME: 256
  },

  // Array limits
  ARRAY: {
    CONTACTS_PER_CAMPAIGN: 10000,
    TAGS_PER_CONTACT: 10,
    VARIABLES_PER_TEMPLATE: 10
  },

  // Time limits
  TIMEOUT: {
    API_REQUEST: 30000, // 30 seconds
    FILE_UPLOAD: 120000, // 2 minutes
    CAMPAIGN_EXECUTION: 3600000 // 1 hour
  }
};

const PAGINATION = {
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
  MIN_LIMIT: 1
};

module.exports = {
  RATE_LIMITS,
  QUOTAS,
  SYSTEM_LIMITS,
  PAGINATION
};