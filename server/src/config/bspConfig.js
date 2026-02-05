/**
 * BSP (Business Solution Provider) Configuration
 * 
 * This configuration centralizes all Meta/WhatsApp credentials for the BSP model.
 * In this architecture, YOU are the BSP like Interakt, and all tenants operate
 * under your single parent WABA using different phone_number_ids.
 * 
 * IMPORTANT: Never allow per-tenant WABA tokens. All API calls go through
 * the parent system user token configured here.
 */

const dotenv = require('dotenv');
dotenv.config();

const bspConfig = {
  // ═══════════════════════════════════════════════════════════════════
  // PARENT WABA CONFIGURATION (Your BSP Account)
  // ═══════════════════════════════════════════════════════════════════
  
  /**
   * Your parent WABA ID - all tenants operate under this single WABA
   * This is your BSP's WhatsApp Business Account ID
   */
  parentWabaId: process.env.META_WABA_ID,
  
  /**
   * Your Meta Business ID - the business that owns the parent WABA
   */
  parentBusinessId: process.env.META_BUSINESS_ID,
  
  /**
   * System User Access Token - PERMANENT token for server-to-server API calls
   * This should be a system user token, NOT a user access token
   * Generate from: Business Settings > System Users > Generate Token
   * Required scopes: whatsapp_business_management, whatsapp_business_messaging
   */
  systemUserToken: process.env.META_ACCESS_TOKEN,
  
  /**
   * Meta App credentials for webhook verification
   */
  appId: process.env.META_APP_ID,
  appSecret: process.env.META_APP_SECRET,
  
  /**
   * Webhook verification token (shared across all webhooks)
   */
  webhookVerifyToken: process.env.META_VERIFY_TOKEN,
  
  // ═══════════════════════════════════════════════════════════════════
  // API CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════
  
  /**
   * Meta Graph API version
   */
  apiVersion: process.env.META_API_VERSION || 'v21.0',
  
  /**
   * Base URL for Meta Graph API
   */
  get baseUrl() {
    return `https://graph.facebook.com/${this.apiVersion}`;
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
    
    if (!this.parentWabaId) {
      errors.push('META_WABA_ID is required');
    }
    
    if (!this.systemUserToken) {
      errors.push('META_ACCESS_TOKEN is required');
    }
    
    if (!this.appSecret) {
      errors.push('META_APP_SECRET is required for webhook verification');
    }
    
    if (!this.webhookVerifyToken) {
      errors.push('META_VERIFY_TOKEN or BSP_WEBHOOK_VERIFY_TOKEN is required');
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
    return !!(this.parentWabaId && this.systemUserToken);
  }
};

// Freeze config to prevent modifications
Object.freeze(bspConfig);
Object.freeze(bspConfig.rateLimits);

module.exports = bspConfig;
