/**
 * BSP (Business Solution Provider) Configuration
 * 
 * This configuration centralizes all Gupshup Partner + WhatsApp credentials.
 * In this architecture, YOU are the BSP partner and all tenants operate
 * under your partner-owned parent app account.
 * 
 * IMPORTANT: Never allow per-tenant provider tokens. All API calls go through
 * centralized partner/api credentials configured here.
 */

const dotenv = require('dotenv');
dotenv.config();

const bspConfig = {
  provider: 'gupshup',

  // ═══════════════════════════════════════════════════════════════════
  // PARTNER APP CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════

  gupshup: {
    partnerToken: process.env.GUPSHUP_PARTNER_TOKEN,
    appId: process.env.GUPSHUP_APP_ID,
    apiKey: process.env.GUPSHUP_API_KEY,
    sourceNumber: process.env.GUPSHUP_SOURCE_NUMBER,
    partnerBaseUrl: process.env.GUPSHUP_PARTNER_BASE_URL || 'https://partner.gupshup.io',
    apiBaseUrl: process.env.GUPSHUP_API_BASE_URL || 'https://api.gupshup.io',
    embedCallbackUrl: process.env.GUPSHUP_EMBED_CALLBACK_URL || `${process.env.APP_URL}/api/v1/onboarding/bsp/callback`,
    webhookAllowedIPs: (process.env.GUPSHUP_WEBHOOK_IPS || '').split(',').map((value) => value.trim()).filter(Boolean)
  },

  // Transitional aliases used by existing modules while migration is in-progress.
  get systemUserToken() {
    return this.gupshup.partnerToken;
  },

  get appId() {
    return this.gupshup.appId;
  },

  get webhookVerifyToken() {
    return null;
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // API CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════
  
  get partnerBaseUrl() {
    return this.gupshup.partnerBaseUrl;
  },

  get apiBaseUrl() {
    return this.gupshup.apiBaseUrl;
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // RATE LIMITING CONFIGURATION (Per Workspace)
  // ═══════════════════════════════════════════════════════════════════
  
  rateLimits: {
    // Messages per second per workspace by plan
    messagesPerSecond: {
      free: 1,        // 1 msg/sec = 3600/hour
      basic: 10,      // 10 msg/sec = 36000/hour
      premium: 50,    // 50 msg/sec = 180000/hour
      enterprise: 200 // 200 msg/sec = 720000/hour
    },
    
    // Daily message limits per workspace by plan
    dailyMessageLimit: {
      free: 100,
      basic: 1000,
      premium: 10000,
      enterprise: 100000
    },
    
    // Monthly message limits per workspace by plan
    monthlyMessageLimit: {
      free: 1000,
      basic: 25000,
      premium: 250000,
      enterprise: 2500000
    },
    
    // Template submissions per day per workspace
    templateSubmissionsPerDay: {
      free: 3,
      basic: 10,
      premium: 50,
      enterprise: 200
    },
    
    // API requests per minute per workspace
    apiRequestsPerMinute: {
      free: 100,
      basic: 500,
      premium: 2000,
      enterprise: 10000
    }
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // TENANT ISOLATION SETTINGS
  // ═══════════════════════════════════════════════════════════════════
  
  /**
   * Enable strict tenant isolation
   * When true, all queries are scoped to workspace
   */
  strictTenantIsolation: true,
  
  /**
   * Log all cross-tenant access attempts
   */
  logCrossTenantAttempts: true,
  
  /**
   * Enable workspace-level message encryption
   */
  enableMessageEncryption: process.env.ENABLE_MESSAGE_ENCRYPTION === 'true',
  
  // ═══════════════════════════════════════════════════════════════════
  // PHONE NUMBER PROVISIONING
  // ═══════════════════════════════════════════════════════════════════
  
  /**
   * Method for assigning phone numbers to tenants
   * 'manual' - Admin assigns phone numbers manually
   * 'pool' - Auto-assign from a pool of available numbers
   */
  phoneAssignmentMode: process.env.BSP_PHONE_ASSIGNMENT_MODE || 'manual',
  
  /**
   * Pool of available phone number IDs for auto-assignment
   */
  phoneNumberPool: (process.env.BSP_PHONE_NUMBER_POOL || '').split(',').filter(Boolean),
  
  // ═══════════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════════════
  
  /**
   * Validate BSP configuration
   */
  validate() {
    const errors = [];

    if (!this.gupshup.partnerToken) {
      errors.push('GUPSHUP_PARTNER_TOKEN is required');
    }

    if (!this.gupshup.apiKey) {
      errors.push('GUPSHUP_API_KEY is required');
    }

    if (!this.gupshup.appId) {
      errors.push('GUPSHUP_APP_ID is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  },
  
  /**
   * Get rate limit for a specific plan and limit type
   */
  getRateLimit(plan, limitType) {
    const planKey = plan || 'free';
    const limits = this.rateLimits[limitType];
    return limits ? (limits[planKey] || limits.free) : null;
  },
  
  /**
   * Check if BSP mode is enabled
   */
  isEnabled() {
    return !!(this.gupshup.partnerToken && this.gupshup.apiKey && this.gupshup.appId);
  }
};

// Freeze config to prevent modifications
Object.freeze(bspConfig);
Object.freeze(bspConfig.rateLimits);

module.exports = bspConfig;
