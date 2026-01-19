/**
 * =============================================================================
 * BSP ONBOARDING SERVICE - INTERAKT PARENTAL MODEL
 * =============================================================================
 * 
 * Business Solution Provider (BSP) onboarding where:
 * - Users onboard via Meta Embedded Signup V2
 * - Their business attaches under YOUR parent WABA
 * - You (BSP) own the WABA, users get phone numbers under it
 * - Fully automated like Interakt
 * 
 * Flow:
 * 1. User clicks "Connect WhatsApp" → Generate ESB URL
 * 2. User completes Meta signup → Redirects to callback
 * 3. Exchange code for token → Fetch WABA & phone from BSP's parent
 * 4. Create workspace with phone under your BSP WABA
 */

const axios = require('axios');
const crypto = require('crypto');
const config = require('../config');
const { logger } = require('../utils/logger');

const META_API_VERSION = 'v21.0';
const META_GRAPH_URL = `https://graph.facebook.com/${META_API_VERSION}`;

// =============================================================================
// BSP CONFIGURATION
// =============================================================================

/**
 * Get BSP configuration from environment
 * These are YOUR BSP credentials, not the user's
 */
function getBspConfig() {
  const bspConfig = {
    appId: process.env.META_APP_ID,
    appSecret: process.env.META_APP_SECRET,
    configId: process.env.META_CONFIG_ID,           // Your ESB config ID
    parentWabaId: process.env.META_WABA_ID,         // Your parent WABA ID
    businessId: process.env.META_BUSINESS_ID,       // Your Meta Business ID
    systemToken: process.env.META_ACCESS_TOKEN,     // Your system user token
    solutionId: process.env.META_SOLUTION_ID,       // BSP Solution ID (if approved by Meta)
    callbackUrl: process.env.ESB_CALLBACK_URL || `${process.env.APP_URL}/api/v1/onboarding/bsp/callback`
  };

  // Validate required config
  const missing = [];
  if (!bspConfig.appId) missing.push('META_APP_ID');
  if (!bspConfig.appSecret) missing.push('META_APP_SECRET');
  if (!bspConfig.configId) missing.push('META_CONFIG_ID');
  if (!bspConfig.parentWabaId) missing.push('META_WABA_ID');
  if (!bspConfig.systemToken) missing.push('META_ACCESS_TOKEN');

  if (missing.length > 0) {
    throw new Error(`BSP configuration incomplete. Missing: ${missing.join(', ')}`);
  }

  return bspConfig;
}

// =============================================================================
// STEP 1: GENERATE EMBEDDED SIGNUP URL
// =============================================================================

/**
 * Generate Meta Embedded Signup V2 URL for BSP model
 * 
 * @param {string} userId - User initiating signup
 * @param {object} options - Pre-fill options
 * @returns {object} - { url, state, expiresAt }
 */
async function generateBspSignupUrl(userId, options = {}) {
  const bsp = getBspConfig();

  // Generate cryptographic state for CSRF protection
  const state = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min

  // ESB V2 extras - sessionInfoVersion 3 returns complete data
  const extras = {
    sessionInfoVersion: '3',
    setup: {
      // Pre-fill if provided
      ...(options.businessName && { 
        business: { name: options.businessName } 
      }),
      ...(options.phone && { 
        phone: { 
          displayPhoneNumber: options.phone,
          category: 'ENTERTAIN'
        } 
      })
    }
  };

  // If we have a solution_id (true BSP model), add it
  // This requires Meta BSP approval
  if (bsp.solutionId) {
    extras.solution_id = bsp.solutionId;
    logger.info('[BSP] Using solution_id for true BSP model');
  }

  // Build OAuth URL with BSP config
  const url = new URL('https://www.facebook.com/v21.0/dialog/oauth');
  url.searchParams.set('client_id', bsp.appId);
  url.searchParams.set('redirect_uri', bsp.callbackUrl);
  url.searchParams.set('state', state);
  url.searchParams.set('config_id', bsp.configId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('override_default_response_type', 'true');
  url.searchParams.set('extras', JSON.stringify(extras));
  
  // Scopes for BSP model
  url.searchParams.set('scope', [
    'whatsapp_business_management',
    'whatsapp_business_messaging'
  ].join(','));

  logger.info(`[BSP] Generated signup URL for user ${userId}`);

  return {
    url: url.toString(),
    state,
    expiresAt: expiresAt.toISOString(),
    configId: bsp.configId
  };
}

// =============================================================================
// STEP 2: EXCHANGE CODE FOR ACCESS TOKEN
// =============================================================================

/**
 * Exchange OAuth code for access token
 * 
 * @param {string} code - OAuth code from callback
 * @returns {object} - { accessToken, expiresIn }
 */
async function exchangeCodeForToken(code) {
  const bsp = getBspConfig();

  try {
    const response = await axios.get(`${META_GRAPH_URL}/oauth/access_token`, {
      params: {
        client_id: bsp.appId,
        client_secret: bsp.appSecret,
        redirect_uri: bsp.callbackUrl,
        code
      }
    });

    logger.info('[BSP] Code exchanged for access token');

    return {
      accessToken: response.data.access_token,
      expiresIn: response.data.expires_in || 5184000 // ~60 days default
    };
  } catch (error) {
    logger.error('[BSP] Token exchange failed:', error.response?.data || error.message);
    throw new Error(`Token exchange failed: ${error.response?.data?.error?.message || error.message}`);
  }
}

// =============================================================================
// STEP 3: FETCH SHARED WABA FROM DEBUG TOKEN
// =============================================================================

/**
 * Debug token to get granular scopes and shared WABA ID
 * In BSP model, the WABA is shared from your parent WABA
 * 
 * @param {string} accessToken - User's access token
 * @returns {object} - { wabaId, businessId, scopes }
 */
async function debugToken(accessToken) {
  const bsp = getBspConfig();

  try {
    const response = await axios.get(`${META_GRAPH_URL}/debug_token`, {
      params: {
        input_token: accessToken,
        access_token: `${bsp.appId}|${bsp.appSecret}`
      }
    });

    const data = response.data.data;
    
    // Extract granular scopes - this contains the shared WABA ID
    const granularScopes = data.granular_scopes || [];
    
    // Find whatsapp_business_management scope for WABA ID
    const wabaScope = granularScopes.find(s => 
      s.scope === 'whatsapp_business_management'
    );
    
    // Find business_management scope for business ID
    const businessScope = granularScopes.find(s => 
      s.scope === 'business_management'
    );

    const wabaIds = wabaScope?.target_ids || [];
    const businessIds = businessScope?.target_ids || [];

    logger.info('[BSP] Token debug:', {
      wabaIds,
      businessIds,
      scopes: data.scopes
    });

    // If no WABA IDs found, customer might need to complete WABA creation
    if (wabaIds.length === 0) {
      logger.warn('[BSP] No WABA IDs in token - customer may not have completed WABA setup');
    }

    return {
      wabaId: wabaIds[0], // First WABA (should be under your parent or customer's)
      businessId: businessIds[0],
      allWabaIds: wabaIds,
      allBusinessIds: businessIds,
      scopes: data.scopes,
      expiresAt: data.expires_at ? new Date(data.expires_at * 1000) : null,
      isValid: data.is_valid
    };
  } catch (error) {
    logger.error('[BSP] Token debug failed:', error.response?.data || error.message);
    throw new Error(`Token debug failed: ${error.response?.data?.error?.message || error.message}`);
  }
}

// =============================================================================
// STEP 4: FETCH PHONE NUMBER FROM WABA
// =============================================================================

/**
 * Fetch phone numbers assigned to the WABA
 * In BSP model, user's phone is added under your parent WABA
 * 
 * @param {string} wabaId - WhatsApp Business Account ID
 * @param {string} accessToken - Access token
 * @returns {object} - Phone number details
 */
async function fetchPhoneNumbers(wabaId, accessToken) {
  try {
    const response = await axios.get(
      `${META_GRAPH_URL}/${wabaId}/phone_numbers`,
      {
        params: {
          access_token: accessToken,
          fields: [
            'id',
            'display_phone_number',
            'verified_name',
            'quality_rating',
            'messaging_limit_tier',
            'code_verification_status',
            'is_official_business_account',
            'account_mode',
            'certificate',
            'name_status',
            'new_name_status'
          ].join(',')
        }
      }
    );

    const phones = response.data.data || [];
    
    logger.info(`[BSP] Found ${phones.length} phone number(s) in WABA ${wabaId}`);

    return phones;
  } catch (error) {
    logger.error('[BSP] Fetch phones failed:', error.response?.data || error.message);
    throw new Error(`Failed to fetch phone numbers: ${error.response?.data?.error?.message || error.message}`);
  }
}

// =============================================================================
// STEP 5: REGISTER PHONE (IF NEEDED)
// =============================================================================

/**
 * Register phone number for Cloud API (if not already registered)
 * 
 * @param {string} phoneId - Phone number ID
 * @param {string} accessToken - Access token
 */
async function registerPhone(phoneId, accessToken) {
  try {
    // Check current registration status
    const statusRes = await axios.get(
      `${META_GRAPH_URL}/${phoneId}`,
      {
        params: {
          access_token: accessToken,
          fields: 'id,display_phone_number,account_mode'
        }
      }
    );

    // If already in LIVE mode, no need to register
    if (statusRes.data.account_mode === 'LIVE') {
      logger.info(`[BSP] Phone ${phoneId} already registered in LIVE mode`);
      return { success: true, alreadyRegistered: true };
    }

    // Register for Cloud API
    const response = await axios.post(
      `${META_GRAPH_URL}/${phoneId}/register`,
      {
        messaging_product: 'whatsapp',
        pin: '123456' // 6-digit PIN for 2FA
      },
      {
        params: { access_token: accessToken }
      }
    );

    logger.info(`[BSP] Phone ${phoneId} registered for Cloud API`);

    return { success: response.data.success, alreadyRegistered: false };
  } catch (error) {
    // 368 = Already registered, which is fine
    if (error.response?.data?.error?.code === 368) {
      logger.info(`[BSP] Phone ${phoneId} already registered`);
      return { success: true, alreadyRegistered: true };
    }
    
    logger.error('[BSP] Phone registration failed:', error.response?.data || error.message);
    throw new Error(`Phone registration failed: ${error.response?.data?.error?.message || error.message}`);
  }
}

// =============================================================================
// STEP 6: SUBSCRIBE WABA TO WEBHOOKS
// =============================================================================

/**
 * Subscribe WABA to your app's webhooks
 * 
 * @param {string} wabaId - WhatsApp Business Account ID
 * @param {string} accessToken - Access token
 */
async function subscribeToWebhooks(wabaId, accessToken) {
  try {
    const response = await axios.post(
      `${META_GRAPH_URL}/${wabaId}/subscribed_apps`,
      {},
      {
        params: { access_token: accessToken }
      }
    );

    logger.info(`[BSP] WABA ${wabaId} subscribed to webhooks`);

    return { success: response.data.success };
  } catch (error) {
    logger.error('[BSP] Webhook subscription failed:', error.response?.data || error.message);
    // Non-fatal - continue onboarding
    return { success: false, error: error.message };
  }
}

// =============================================================================
// STEP 7: FETCH BUSINESS PROFILE
// =============================================================================

/**
 * Fetch business profile for the phone
 * 
 * @param {string} phoneId - Phone number ID
 * @param {string} accessToken - Access token
 */
async function fetchBusinessProfile(phoneId, accessToken) {
  try {
    const response = await axios.get(
      `${META_GRAPH_URL}/${phoneId}/whatsapp_business_profile`,
      {
        params: {
          access_token: accessToken,
          fields: 'about,address,description,email,profile_picture_url,websites,vertical'
        }
      }
    );

    return response.data.data?.[0] || {};
  } catch (error) {
    logger.warn('[BSP] Business profile fetch failed:', error.message);
    return {};
  }
}

// =============================================================================
// COMPLETE ONBOARDING FLOW
// =============================================================================

/**
 * Complete BSP onboarding after OAuth callback
 * 
 * Supports two modes:
 * 1. True BSP (with solution_id): Phone created under YOUR parent WABA
 * 2. Managed WABA: Customer gets their own WABA, you manage it via token
 * 
 * @param {string} code - OAuth code from Meta
 * @returns {object} - Complete onboarding result
 */
async function completeBspOnboarding(code) {
  const bsp = getBspConfig();

  // Step 1: Exchange code for token
  const { accessToken, expiresIn } = await exchangeCodeForToken(code);

  // Step 2: Debug token to get WABA ID
  const tokenInfo = await debugToken(accessToken);

  // Determine which WABA to use
  let wabaId;
  let isTrueBspModel = false;

  if (bsp.solutionId && tokenInfo.wabaId === bsp.parentWabaId) {
    // True BSP model - phone is under our parent WABA
    wabaId = bsp.parentWabaId;
    isTrueBspModel = true;
    logger.info('[BSP] True BSP model - using parent WABA');
  } else if (tokenInfo.wabaId) {
    // Managed WABA model - customer has their own WABA
    wabaId = tokenInfo.wabaId;
    logger.info('[BSP] Managed WABA model - customer WABA:', wabaId);
  } else {
    throw new Error('No WhatsApp Business Account found. User may not have completed signup.');
  }

  // Step 3: Fetch phone numbers from WABA
  const phones = await fetchPhoneNumbers(wabaId, accessToken);

  if (phones.length === 0) {
    throw new Error('No phone number found in WABA. User may need to add a phone number during signup.');
  }

  // Use the first/most recently added phone
  const primaryPhone = phones[0];

  // Step 4: Register phone for Cloud API (if needed)
  await registerPhone(primaryPhone.id, accessToken);

  // Step 5: Subscribe to webhooks
  await subscribeToWebhooks(wabaId, accessToken);

  // Step 6: Fetch business profile
  const businessProfile = await fetchBusinessProfile(primaryPhone.id, accessToken);

  // Build complete result
  const result = {
    // Business identifiers
    businessId: tokenInfo.businessId,
    wabaId: wabaId,
    
    // Phone details
    phoneNumberId: primaryPhone.id,
    displayPhoneNumber: primaryPhone.display_phone_number,
    verifiedName: primaryPhone.verified_name,
    
    // Phone status
    qualityRating: primaryPhone.quality_rating || 'UNKNOWN',
    messagingLimit: primaryPhone.messaging_limit_tier || 'TIER_NOT_SET',
    codeVerificationStatus: primaryPhone.code_verification_status,
    nameStatus: primaryPhone.name_status || primaryPhone.new_name_status,
    isOfficialAccount: primaryPhone.is_official_business_account || false,
    
    // Token info
    accessToken,
    tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
    
    // Business profile
    businessProfile,
    
    // All phones (for multi-phone support later)
    allPhones: phones.map(p => ({
      id: p.id,
      displayPhoneNumber: p.display_phone_number,
      verifiedName: p.verified_name,
      qualityRating: p.quality_rating
    })),
    
    // BSP context
    bspWabaId: bsp.parentWabaId,
    isBspManaged: true,
    isTrueBspModel, // True if phone is under parent WABA
    
    // Timestamps
    connectedAt: new Date()
  };

  logger.info('[BSP] Onboarding complete:', {
    wabaId: result.wabaId,
    phoneId: result.phoneNumberId,
    phone: result.displayPhoneNumber
  });

  return result;
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  getBspConfig,
  generateBspSignupUrl,
  exchangeCodeForToken,
  debugToken,
  fetchPhoneNumbers,
  registerPhone,
  subscribeToWebhooks,
  fetchBusinessProfile,
  completeBspOnboarding
};
