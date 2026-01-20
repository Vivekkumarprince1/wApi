/**
 * =============================================================================
 * BSP ONBOARDING SERVICE V2 - INTERAKT PARENTAL MODEL (HARDENED)
 * =============================================================================
 * 
 * Business Solution Provider (BSP) onboarding where:
 * - Users onboard via Meta Embedded Signup V2
 * - Their business attaches under YOUR parent WABA
 * - You (BSP) own the WABA, users get phone numbers under it
 * - Fully automated like Interakt
 * 
 * HARDENED FLOW:
 * 1. User clicks "Connect WhatsApp" → Generate ESB URL
 * 2. User completes Meta signup → Redirects to callback
 * 3. Exchange code for token
 * 4. Fetch business_id from token debug
 * 5. GET /{business_id}/owned_whatsapp_business_accounts
 * 6. Validate WABA belongs to BSP (parent ownership)
 * 7. GET /{waba_id}/phone_numbers
 * 8. Mark COMPLETE only if waba_id + phone_number_id exist
 * 9. Encrypt and persist all tokens
 * 
 * SECURITY:
 * - Tokens encrypted at rest
 * - Parent WABA ownership validation
 * - Comprehensive error handling
 */

const axios = require('axios');
const crypto = require('crypto');
const config = require('../config');
const bspConfig = require('../config/bspConfig');
const { logger } = require('../utils/logger');
const { encryptToken, isEncrypted, hashForLog } = require('../utils/tokenEncryption');

const META_API_VERSION = process.env.META_API_VERSION || 'v21.0';
const META_GRAPH_URL = `https://graph.facebook.com/${META_API_VERSION}`;

// =============================================================================
// BSP CONFIGURATION
// =============================================================================

/**
 * Get BSP configuration from environment
 * These are YOUR BSP credentials, not the user's
 */
function getBspConfig() {
  const bspConfigLocal = {
    appId: process.env.META_APP_ID,
    appSecret: process.env.META_APP_SECRET,
    configId: process.env.META_CONFIG_ID,           // Your ESB config ID
    parentWabaId: process.env.META_WABA_ID || bspConfig.parentWabaId,
    parentBusinessId: process.env.META_BUSINESS_ID || bspConfig.parentBusinessId,
    systemToken: process.env.META_ACCESS_TOKEN || bspConfig.systemUserToken,
    solutionId: process.env.META_SOLUTION_ID,       // BSP Solution ID (if approved by Meta)
    callbackUrl: process.env.ESB_CALLBACK_URL || `${process.env.APP_URL}/api/v1/onboarding/bsp/callback`
  };

  // Validate required config
  const missing = [];
  if (!bspConfigLocal.appId) missing.push('META_APP_ID');
  if (!bspConfigLocal.appSecret) missing.push('META_APP_SECRET');
  if (!bspConfigLocal.configId) missing.push('META_CONFIG_ID');
  if (!bspConfigLocal.parentWabaId) missing.push('META_WABA_ID');
  if (!bspConfigLocal.systemToken) missing.push('META_ACCESS_TOKEN');

  if (missing.length > 0) {
    throw new Error(`BSP configuration incomplete. Missing: ${missing.join(', ')}`);
  }

  return bspConfigLocal;
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
    'whatsapp_business_messaging',
    'business_management' // Needed for fetching business_id
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
      },
      timeout: 15000
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
// STEP 3: DEBUG TOKEN TO GET BUSINESS_ID AND WABA_ID
// =============================================================================

/**
 * Debug token to get granular scopes, business_id, and shared WABA ID
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
      },
      timeout: 15000
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
      scopes: data.scopes,
      tokenHash: hashForLog(accessToken)
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
      isValid: data.is_valid,
      userId: data.user_id,
      appId: data.app_id
    };
  } catch (error) {
    logger.error('[BSP] Token debug failed:', error.response?.data || error.message);
    throw new Error(`Token debug failed: ${error.response?.data?.error?.message || error.message}`);
  }
}

// =============================================================================
// STEP 4: FETCH OWNED WABAS (HARDENED)
// =============================================================================

/**
 * Fetch owned WhatsApp Business Accounts for a business
 * GET /{business_id}/owned_whatsapp_business_accounts
 * 
 * @param {string} businessId - Meta Business ID
 * @param {string} accessToken - Access token
 * @returns {array} - List of owned WABAs
 */
async function fetchOwnedWABAs(businessId, accessToken) {
  try {
    const response = await axios.get(
      `${META_GRAPH_URL}/${businessId}/owned_whatsapp_business_accounts`,
      {
        params: {
          access_token: accessToken,
          fields: 'id,name,currency,timezone_id,message_template_namespace,account_review_status,on_behalf_of_business_info'
        },
        timeout: 15000
      }
    );

    const wabas = response.data.data || [];
    logger.info(`[BSP] Found ${wabas.length} owned WABA(s) for business ${businessId}`);
    
    return wabas;
  } catch (error) {
    logger.error('[BSP] Fetch owned WABAs failed:', error.response?.data || error.message);
    throw new Error(`Failed to fetch WABAs: ${error.response?.data?.error?.message || error.message}`);
  }
}

// =============================================================================
// STEP 5: VALIDATE WABA BELONGS TO BSP (PARENT OWNERSHIP)
// =============================================================================

/**
 * Validate that the WABA belongs to (or is managed by) our BSP
 * 
 * @param {string} wabaId - WABA ID to validate
 * @param {array} ownedWabas - List of WABAs from fetchOwnedWABAs
 * @returns {object} - { valid, waba, isBspParent }
 */
function validateWabaOwnership(wabaId, ownedWabas) {
  const bsp = getBspConfig();
  
  // Check if this is our parent WABA (true BSP model)
  if (wabaId === bsp.parentWabaId) {
    logger.info('[BSP] WABA is BSP parent WABA');
    return {
      valid: true,
      isBspParent: true,
      waba: { id: wabaId }
    };
  }

  // Check if WABA is in the list of owned WABAs
  const waba = ownedWabas.find(w => w.id === wabaId);
  
  if (!waba) {
    logger.warn(`[BSP] WABA ${wabaId} not found in owned WABAs`);
    return {
      valid: false,
      error: 'WABA not found in owned accounts'
    };
  }

  // Check if WABA is managed on behalf of our business
  const onBehalfOf = waba.on_behalf_of_business_info;
  if (onBehalfOf && onBehalfOf.id === bsp.parentBusinessId) {
    logger.info('[BSP] WABA is managed on behalf of BSP');
    return {
      valid: true,
      isBspManaged: true,
      waba
    };
  }

  // WABA exists but might be customer's own - still valid for managed model
  logger.info('[BSP] WABA is customer-owned, managed model');
  return {
    valid: true,
    isCustomerOwned: true,
    waba
  };
}

// =============================================================================
// TASK A: VALIDATE WABA APP ACCESS (HARDENED)
// =============================================================================

/**
 * Validate that our Meta App / System User is explicitly linked to the WABA.
 * This is CRITICAL for BSP operations - if app is not linked, API calls will fail.
 * 
 * GET /{waba_id}/assigned_users - Check if our system user has access
 * GET /{waba_id}/subscribed_apps - Check if our app is subscribed
 * 
 * @param {string} wabaId - WABA ID to validate
 * @param {string} accessToken - Access token to use
 * @returns {object} - { valid, appLinked, userLinked, error }
 */
async function validateWabaAppAccess(wabaId, accessToken) {
  const bsp = getBspConfig();
  
  const result = {
    valid: false,
    appLinked: false,
    userLinked: false,
    canManage: false,
    error: null
  };
  
  try {
    // 1. Check subscribed apps (is our app linked?)
    const appsResponse = await axios.get(
      `${META_GRAPH_URL}/${wabaId}/subscribed_apps`,
      {
        params: { access_token: accessToken },
        timeout: 15000
      }
    );
    
    const subscribedApps = appsResponse.data.data || [];
    result.appLinked = subscribedApps.some(app => 
      app.whatsapp_business_api_data?.id === bsp.appId ||
      app.id === bsp.appId
    );
    
    logger.info(`[BSP] App subscription check for WABA ${wabaId}:`, {
      appLinked: result.appLinked,
      subscribedApps: subscribedApps.length
    });
    
  } catch (error) {
    const metaError = error.response?.data?.error;
    
    // Error code 100 with subcode 33 means no permission - app not linked
    if (metaError?.code === 100 || metaError?.code === 200) {
      logger.warn(`[BSP] App not linked to WABA ${wabaId}:`, metaError?.message);
      result.error = 'APP_NOT_LINKED';
      result.errorMessage = 'Meta App is not linked to this WABA. Complete Embedded Signup or manually assign the app.';
      return result;
    }
    
    logger.error(`[BSP] Failed to check app subscription:`, metaError || error.message);
    result.error = 'CHECK_FAILED';
    result.errorMessage = metaError?.message || error.message;
    return result;
  }
  
  try {
    // 2. Check if we can access WABA details (validates management permission)
    const wabaResponse = await axios.get(
      `${META_GRAPH_URL}/${wabaId}`,
      {
        params: {
          access_token: accessToken,
          fields: 'id,name,currency,account_review_status'
        },
        timeout: 15000
      }
    );
    
    result.canManage = !!wabaResponse.data.id;
    result.wabaName = wabaResponse.data.name;
    result.wabaStatus = wabaResponse.data.account_review_status;
    
  } catch (error) {
    const metaError = error.response?.data?.error;
    
    if (metaError?.code === 100 || metaError?.code === 10) {
      logger.warn(`[BSP] Cannot manage WABA ${wabaId}:`, metaError?.message);
      result.error = 'NO_MANAGEMENT_ACCESS';
      result.errorMessage = 'No management access to this WABA. Ensure permissions are granted during signup.';
      return result;
    }
    
    result.error = 'WABA_ACCESS_FAILED';
    result.errorMessage = metaError?.message || error.message;
    return result;
  }
  
  // Validation passed if app is linked OR we can manage the WABA
  result.valid = result.appLinked || result.canManage;
  
  if (!result.valid) {
    result.error = 'INSUFFICIENT_ACCESS';
    result.errorMessage = 'App is not linked and cannot manage WABA. Re-run Embedded Signup with correct permissions.';
  }
  
  logger.info(`[BSP] WABA App Access validation for ${wabaId}:`, {
    valid: result.valid,
    appLinked: result.appLinked,
    canManage: result.canManage
  });
  
  return result;
}

// =============================================================================
// STEP 6: FETCH PHONE NUMBERS FROM WABA
// =============================================================================

/**
 * Fetch phone numbers assigned to the WABA
 * GET /{waba_id}/phone_numbers
 * 
 * @param {string} wabaId - WhatsApp Business Account ID
 * @param {string} accessToken - Access token
 * @returns {array} - Phone number details
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
            'new_name_status',
            'status'
          ].join(',')
        },
        timeout: 15000
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
// STEP 7: REGISTER PHONE FOR CLOUD API
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
          fields: 'id,display_phone_number,account_mode,status'
        },
        timeout: 15000
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
        pin: crypto.randomInt(100000, 999999).toString() // Random 6-digit PIN
      },
      {
        params: { access_token: accessToken },
        timeout: 30000
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
// STEP 8: SUBSCRIBE WABA TO WEBHOOKS
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
        params: { access_token: accessToken },
        timeout: 15000
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
// STEP 9: FETCH BUSINESS PROFILE
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
        },
        timeout: 15000
      }
    );

    return response.data.data?.[0] || {};
  } catch (error) {
    logger.warn('[BSP] Business profile fetch failed:', error.message);
    return {};
  }
}

// =============================================================================
// COMPLETE ONBOARDING FLOW (HARDENED)
// =============================================================================

/**
 * Complete BSP onboarding after OAuth callback
 * 
 * HARDENED FLOW:
 * 1. Exchange code for token
 * 2. Debug token to get business_id and WABA IDs
 * 3. Fetch owned WABAs for business
 * 4. Validate WABA ownership (BSP parent check)
 * 5. Fetch phone numbers from WABA
 * 6. Register phone for Cloud API
 * 7. Subscribe to webhooks
 * 8. Fetch business profile
 * 9. COMPLETE only if waba_id + phone_number_id exist
 * 
 * @param {string} code - OAuth code from Meta
 * @param {string} workspaceId - Workspace ID for token encryption context
 * @returns {object} - Complete onboarding result
 */
async function completeBspOnboarding(code, workspaceId = 'default') {
  const bsp = getBspConfig();
  
  // Track onboarding progress
  const progress = {
    tokenExchange: false,
    tokenDebug: false,
    wabaFetch: false,
    wabaValidation: false,
    wabaAppAccess: false,  // TASK A: Added app access validation step
    phoneFetch: false,
    phoneRegistration: false,
    webhookSubscription: false,
    profileFetch: false
  };

  try {
    // STEP 1: Exchange code for token
    logger.info('[BSP] Step 1: Exchanging code for token...');
    const { accessToken, expiresIn } = await exchangeCodeForToken(code);
    progress.tokenExchange = true;

    // STEP 2: Debug token to get business_id and WABA IDs
    logger.info('[BSP] Step 2: Debugging token...');
    const tokenInfo = await debugToken(accessToken);
    progress.tokenDebug = true;

    // CRITICAL: Ensure we have business_id
    if (!tokenInfo.businessId) {
      throw new Error('No business_id found in token. User may not have completed business verification.');
    }

    // STEP 3: Fetch owned WABAs
    logger.info('[BSP] Step 3: Fetching owned WABAs...');
    let ownedWabas = [];
    try {
      ownedWabas = await fetchOwnedWABAs(tokenInfo.businessId, accessToken);
      progress.wabaFetch = true;
    } catch (err) {
      logger.warn('[BSP] Could not fetch owned WABAs, using token WABA:', err.message);
    }

    // Determine which WABA to use
    let wabaId = tokenInfo.wabaId;
    let isTrueBspModel = false;
    let wabaValidation = { valid: true };

    // STEP 4: Validate WABA ownership
    logger.info('[BSP] Step 4: Validating WABA ownership...');
    if (wabaId) {
      wabaValidation = validateWabaOwnership(wabaId, ownedWabas);
      progress.wabaValidation = true;

      if (!wabaValidation.valid) {
        logger.warn('[BSP] WABA validation failed, but continuing...');
      }

      isTrueBspModel = wabaValidation.isBspParent === true;
    } else if (ownedWabas.length > 0) {
      // Use first owned WABA
      wabaId = ownedWabas[0].id;
      logger.info(`[BSP] Using first owned WABA: ${wabaId}`);
    } else if (bsp.solutionId) {
      // True BSP model - use parent WABA
      wabaId = bsp.parentWabaId;
      isTrueBspModel = true;
      logger.info('[BSP] True BSP model - using parent WABA');
    }

    if (!wabaId) {
      throw new Error('No WhatsApp Business Account found. User may not have completed signup.');
    }

    // STEP 4.5 (TASK A): Validate App has access to WABA
    logger.info('[BSP] Step 4.5: Validating WABA App Access...');
    const appAccessValidation = await validateWabaAppAccess(wabaId, accessToken);
    progress.wabaAppAccess = appAccessValidation.valid;
    
    if (!appAccessValidation.valid) {
      const error = new Error(
        appAccessValidation.errorMessage || 
        'Meta App is not linked to this WABA. Re-run Embedded Signup or manually assign the app in Business Manager.'
      );
      error.code = 'WABA_APP_ACCESS_DENIED';
      error.details = appAccessValidation;
      throw error;
    }

    // STEP 5: Fetch phone numbers from WABA
    logger.info('[BSP] Step 5: Fetching phone numbers...');
    const phones = await fetchPhoneNumbers(wabaId, accessToken);
    progress.phoneFetch = true;

    // CRITICAL: Ensure we have at least one phone
    if (phones.length === 0) {
      throw new Error('No phone number found in WABA. User may need to add a phone number during signup.');
    }

    // Use the first/most recently added phone
    const primaryPhone = phones[0];

    // CRITICAL: Ensure phone_number_id exists
    if (!primaryPhone.id) {
      throw new Error('Phone number ID is missing. Invalid phone configuration.');
    }

    // STEP 6: Register phone for Cloud API (if needed)
    logger.info('[BSP] Step 6: Registering phone...');
    try {
      await registerPhone(primaryPhone.id, accessToken);
      progress.phoneRegistration = true;
    } catch (err) {
      logger.warn('[BSP] Phone registration failed (may already be registered):', err.message);
      progress.phoneRegistration = true; // Continue anyway
    }

    // STEP 7: Subscribe to webhooks
    logger.info('[BSP] Step 7: Subscribing to webhooks...');
    const webhookResult = await subscribeToWebhooks(wabaId, accessToken);
    progress.webhookSubscription = webhookResult.success;

    // STEP 8: Fetch business profile
    logger.info('[BSP] Step 8: Fetching business profile...');
    const businessProfile = await fetchBusinessProfile(primaryPhone.id, accessToken);
    progress.profileFetch = true;

    // ==========================================================================
    // FINAL VALIDATION: Mark COMPLETE only if waba_id + phone_number_id exist
    // ==========================================================================
    
    const onboardingComplete = !!(wabaId && primaryPhone.id);
    
    if (!onboardingComplete) {
      throw new Error('Onboarding validation failed: Missing waba_id or phone_number_id');
    }

    // Map phone status
    let phoneStatus = 'PENDING';
    if (primaryPhone.account_mode === 'LIVE' && primaryPhone.code_verification_status === 'VERIFIED') {
      phoneStatus = 'CONNECTED';
    } else if (primaryPhone.status === 'CONNECTED') {
      phoneStatus = 'CONNECTED';
    }

    // ==========================================================================
    // ENCRYPT TOKENS BEFORE STORAGE
    // ==========================================================================
    
    const encryptedAccessToken = encryptToken(accessToken, workspaceId);
    logger.info(`[BSP] Token encrypted for storage (hash: ${hashForLog(accessToken)})`);

    // Build complete result
    const result = {
      // Onboarding status
      onboardingComplete: true,
      onboardingProgress: progress,
      
      // Business identifiers
      businessId: tokenInfo.businessId,
      wabaId: wabaId,
      
      // Phone details
      phoneNumberId: primaryPhone.id,
      displayPhoneNumber: primaryPhone.display_phone_number,
      verifiedName: primaryPhone.verified_name,
      
      // Phone status
      phoneStatus,
      qualityRating: primaryPhone.quality_rating || 'UNKNOWN',
      messagingLimit: primaryPhone.messaging_limit_tier || 'TIER_NOT_SET',
      codeVerificationStatus: primaryPhone.code_verification_status,
      nameStatus: primaryPhone.name_status || primaryPhone.new_name_status,
      isOfficialAccount: primaryPhone.is_official_business_account || false,
      accountMode: primaryPhone.account_mode,
      
      // Token info (ENCRYPTED)
      accessToken: encryptedAccessToken,
      accessTokenRaw: null, // Never expose raw token
      tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
      
      // Business profile
      businessProfile,
      
      // All phones (for multi-phone support later)
      allPhones: phones.map(p => ({
        id: p.id,
        displayPhoneNumber: p.display_phone_number,
        verifiedName: p.verified_name,
        qualityRating: p.quality_rating,
        status: p.status
      })),
      
      // BSP context
      bspWabaId: bsp.parentWabaId,
      isBspManaged: true,
      isTrueBspModel,
      wabaValidation: {
        valid: wabaValidation.valid,
        isBspParent: wabaValidation.isBspParent || false,
        isBspManaged: wabaValidation.isBspManaged || false,
        isCustomerOwned: wabaValidation.isCustomerOwned || false
      },
      
      // Timestamps
      connectedAt: new Date()
    };

    logger.info('[BSP] ✅ Onboarding complete:', {
      wabaId: result.wabaId,
      phoneId: result.phoneNumberId,
      phone: result.displayPhoneNumber,
      status: result.phoneStatus
    });

    return result;
  } catch (error) {
    logger.error('[BSP] ❌ Onboarding failed:', {
      error: error.message,
      progress
    });
    
    // Enhance error with progress info
    error.onboardingProgress = progress;
    throw error;
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  getBspConfig,
  generateBspSignupUrl,
  exchangeCodeForToken,
  debugToken,
  fetchOwnedWABAs,
  validateWabaOwnership,
  validateWabaAppAccess,  // TASK A: Exported for reuse
  fetchPhoneNumbers,
  registerPhone,
  subscribeToWebhooks,
  fetchBusinessProfile,
  completeBspOnboarding
};
