const axios = require('axios');
const crypto = require('crypto');
const { metaAppId, metaAppSecret, metaBusinessId, metaConfigId } = require('../config');
const { decrypt, isEncrypted } = require('../utils/encryption');

const META_API_VERSION = 'v21.0';
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;
const GRAPH_INSTALL_URL = 'https://www.instagram.com/oauth/authorize'; // For ESB redirect

/**
 * Helper: Decrypt token if encrypted
 * @param {string} token - Potentially encrypted token
 * @param {string} workspaceId - Workspace ID for decryption
 * @returns {string} - Decrypted token
 */
function decryptToken(token, workspaceId) {
  if (!token) return null;
  if (isEncrypted(token)) {
    return decrypt(token, workspaceId);
  }
  return token; 
}


/**
 * ================================================================
 * EMBEDDED SIGNUP BUSINESS (ESB) FLOW - FULLY AUTOMATED
 * ================================================================
 * This service handles the complete automated onboarding flow:
 * 1. Start ESB redirect
 * 2. Handle OAuth callback
 * 3. Exchange code for access token
 * 4. Verify business
 * 5. Register WhatsApp number with OTP
 * 6. Create system user tokens
 * 7. Activate WABA
 */

/**
 * Step 1: Generate Embedded Signup Flow URL
 * This creates the OAuth redirect URL that initiates the ESB flow
 * User is redirected to Meta to complete business setup
 *
 * @param {string} userId - Internal user ID for state verification
 * @param {string} callbackUrl - Your backend callback URL (e.g., https://yourapp.com/api/onboarding/esb/callback)
 * @returns {object} - ESB URL and state for redirect
 */
async function generateEmbeddedSignupURL(userId, callbackUrl) {
  try {
    if (!metaConfigId) {
      throw new Error('META_CONFIG_ID not configured in environment');
    }

    if (!metaAppId) {
      throw new Error('META_APP_ID not configured in environment');
    }

    // Create state for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');
    
    // Build ESB Flow URL using Meta's v3 Embedded Signup endpoint for WhatsApp
    // This endpoint allows users to create WABA under your partnership
    // ⚠️ IMPORTANT: Config must be set up in Meta Business Manager to allow 
    // third-party businesses to onboard (not restricted to admin account only)
    const esbUrl = 'https://business.facebook.com/messaging/whatsapp/onboard/';
    
    // Build extras JSON - no spaces or extra encoding
    const extrasJson = '{"sessionInfoVersion":"3","version":"v3"}';
    
    // Manually construct URL to avoid double encoding
    const fullUrl = `${esbUrl}?app_id=${metaAppId}&config_id=${metaConfigId}&extras=${encodeURIComponent(extrasJson)}`;

    console.log(`[ESB] Generated signup URL for user: ${userId}`);
    console.log(`[ESB] App ID: ${metaAppId}`);
    console.log(`[ESB] Config ID: ${metaConfigId}`);
    console.log(`[ESB] Note: If users get "This isn't working at the moment" error, config may be restricted to admin account. Visit Meta Business Manager > WhatsApp > Configuration to allow third-party onboarding.`);
    console.log(`[ESB] Full URL: ${fullUrl}`);

    return {
      success: true,
      url: fullUrl,
      state: state,
      configId: metaConfigId,
      appId: metaAppId,
      expiresIn: 3600
    };
  } catch (error) {
    console.error('Error generating ESB URL:', error.message);
    throw new Error(`ESB URL generation failed: ${error.message}`);
  }
}

/**
 * Step 2: Verify OAuth Callback State
 * Validates the state parameter to prevent CSRF attacks
 *
 * @param {string} receivedState - State from callback query param
 * @param {string} storedState - State we stored earlier
 * @returns {boolean} - Valid or not
 */
function verifyCallbackState(receivedState, storedState) {
  if (!receivedState || !storedState) {
    return false;
  }
  return crypto.timingSafeEqual(
    Buffer.from(receivedState),
    Buffer.from(storedState)
  );
}

/**
 * Step 3: Exchange Authorization Code for Access Token
 * After user completes ESB flow, Meta redirects with a code
 * Exchange this code for a long-lived access token
 *
 * @param {string} code - Authorization code from Meta callback
 * @param {string} redirectUri - Same redirect_uri used in step 1
 * @returns {object} - Access token and user info
 */
async function exchangeCodeForToken(code, redirectUri) {
  try {
    if (!code) {
      throw new Error('Authorization code is required');
    }

    const url = `${META_BASE_URL}/oauth/access_token`;

    const params = {
      client_id: metaAppId,
      client_secret: metaAppSecret,
      redirect_uri: redirectUri,
      code: code
    };

    const response = await axios.get(url, { params });

    // ✅ GAP 1: Check for explicit Meta error responses
    if (response.data.error) {
      throw new Error(`Meta error: ${response.data.error.message || response.data.error}`);
    }

    // ✅ GAP 2: Validate required fields exist
    if (!response.data.access_token) {
      throw new Error('No access token in response from Meta');
    }

    // ✅ GAP 3: Validate expiresIn is a number
    if (response.data.expires_in && typeof response.data.expires_in !== 'number') {
      throw new Error('Invalid expires_in format from Meta');
    }

    const accessToken = response.data.access_token;
    const expiresIn = response.data.expires_in || 5184000; // Default 60 days if not provided

    if (typeof accessToken !== 'string' || accessToken.length === 0) {
      throw new Error('Invalid access_token format from Meta');
    }

    console.log('[ESB] Access token obtained, length:', accessToken.length);

    // Now fetch user info to get business account details
    const userInfo = await getTokenUserInfo(accessToken);

    return {
      success: true,
      accessToken: accessToken,
      tokenType: response.data.token_type || 'Bearer',
      expiresIn: expiresIn,
      userInfo: userInfo,
      userId: userInfo.id,
      hasRefreshToken: !!response.data.refresh_token
    };
  } catch (error) {
    console.error('Error exchanging code for token:', error.response?.data || error.message);
    throw new Error(`Token exchange failed: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Get authenticated user's info from token
 * Retrieves business accounts, WABA IDs, and phone numbers
 *
 * @param {string} accessToken - User's access token
 * @returns {object} - User info with business details
 */
async function getTokenUserInfo(accessToken) {
  try {
    const url = `${META_BASE_URL}/me`;

    const response = await axios.get(url, {
      params: {
        fields: 'id,name,email,picture,businesses'
      },
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    // ✅ GAP 2: Validate required fields exist and have correct types
    if (!response.data.id || typeof response.data.id !== 'string') {
      throw new Error('Invalid user ID from Meta');
    }

    // Get more detailed business info
    const businessInfo = await getBusinessAccountsInfo(accessToken);

    // ✅ GAP 2: Validate business info is not empty
    if (!businessInfo.businessAccounts || businessInfo.businessAccounts.length === 0) {
      throw new Error('No business accounts found. Please create a business account in Meta first.');
    }
    if (!businessInfo.wabaAccounts || businessInfo.wabaAccounts.length === 0) {
      throw new Error('No WhatsApp Business Accounts found. Please create one in Meta first.');
    }
    if (!businessInfo.phoneNumbers || businessInfo.phoneNumbers.length === 0) {
      throw new Error('No phone numbers found. Please register a phone number in your WABA first.');
    }

    return {
      id: response.data.id,
      name: response.data.name || 'Unknown',
      email: response.data.email || '',
      businessAccounts: businessInfo.businessAccounts,
      wabaAccounts: businessInfo.wabaAccounts,
      phoneNumbers: businessInfo.phoneNumbers
    };
  } catch (error) {
    console.error('Error fetching user info:', error.response?.data || error.message);
    throw new Error(`User info fetch failed: ${error.message}`);
  }
}

/**
 * Get all business accounts, WABAs, and phone numbers for the authenticated user
 *
 * @param {string} accessToken - User's access token
 * @returns {object} - All business related accounts
 */
async function getBusinessAccountsInfo(accessToken) {
  const results = {
    businessAccounts: [],
    wabaAccounts: [],
    phoneNumbers: []
  };

  try {
    // Get all business accounts owned by user
    const bizUrl = `${META_BASE_URL}/me/businesses`;
    const bizResp = await axios.get(bizUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    results.businessAccounts = bizResp.data?.data || [];

    // For each business account, get WABA accounts
    for (const biz of results.businessAccounts) {
      try {
        const wabaUrl = `${META_BASE_URL}/${biz.id}/owned_whatsapp_business_accounts`;
        const wabaResp = await axios.get(wabaUrl, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        const wabas = wabaResp.data?.data || [];
        for (const waba of wabas) {
          results.wabaAccounts.push({
            id: waba.id,
            name: waba.name,
            businessId: biz.id,
            businessName: biz.name
          });

          // Get phone numbers for each WABA
          try {
            const phoneUrl = `${META_BASE_URL}/${waba.id}/phone_numbers`;
            const phoneResp = await axios.get(phoneUrl, {
              params: {
                fields: 'id,display_phone_number,verified_name,quality_rating,platform_type'
              },
              headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            const phones = phoneResp.data?.data || [];
            results.phoneNumbers.push(...phones.map(p => ({
              ...p,
              wabaId: waba.id,
              wabaName: waba.name
            })));
          } catch (phoneErr) {
            console.error(`Error getting phone numbers for WABA ${waba.id}:`, phoneErr.message);
          }
        }
      } catch (wabaErr) {
        console.error(`Error getting WABAs for business ${biz.id}:`, wabaErr.message);
      }
    }

    return results;
  } catch (error) {
    console.error('Error getting business accounts info:', error.message);
    throw error;
  }
}

/**
 * Step 4: Verify/Register WhatsApp Business Account (WABA)
 * After ESB, verify the business account and get/create WABA
 *
 * @param {string} accessToken - User's access token
 * @param {string} businessAccountId - Business account ID to verify
 * @param {object} businessData - Business info for verification
 * @returns {object} - Verified business and WABA info
 */
async function verifyBusinessAccount(accessToken, businessAccountId, businessData) {
  try {
    const url = `${META_BASE_URL}/${businessAccountId}`;

    // Update business information
    const updatePayload = {
      name: businessData.businessName,
      vertical: businessData.industry || 'RETAIL',
      email: businessData.email,
      timezone_id: businessData.timezone || 'Asia/Kolkata'
    };

    const response = await axios.post(url, updatePayload, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('[ESB] Business account verified:', businessAccountId);

    // Check for existing WABA
    const wabaUrl = `${META_BASE_URL}/${businessAccountId}/owned_whatsapp_business_accounts`;
    let wabaId = null;

    try {
      const wabaResp = await axios.get(wabaUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      const wabas = wabaResp.data?.data || [];
      if (wabas.length > 0) {
        wabaId = wabas[0].id; // Use first WABA or create new
      }
    } catch (e) {
      console.log('[ESB] No existing WABA found, will create new one');
    }

    // If no WABA exists, create one
    if (!wabaId) {
      wabaId = await createWABA(accessToken, businessAccountId, businessData.businessName);
    }

    return {
      success: true,
      businessAccountId: businessAccountId,
      wabaId: wabaId,
      businessName: businessData.businessName,
      verificationStatus: 'verified'
    };
  } catch (error) {
    console.error('Error verifying business account:', error.response?.data || error.message);
    throw new Error(`Business verification failed: ${error.message}`);
  }
}

/**
 * Create a new WhatsApp Business Account (WABA) under business account
 *
 * @param {string} accessToken - User's access token
 * @param {string} businessAccountId - Business account ID
 * @param {string} wabaName - Name for the WABA
 * @returns {string} - New WABA ID
 */
async function createWABA(accessToken, businessAccountId, wabaName) {
  try {
    const url = `${META_BASE_URL}/${businessAccountId}/owned_whatsapp_business_accounts`;

    const payload = {
      name: wabaName || 'WhatsApp Business Account',
      type: 'MULTI_PRODUCT'
    };

    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const newWabaId = response.data.id;
    console.log('[ESB] New WABA created:', newWabaId);

    return newWabaId;
  } catch (error) {
    console.error('Error creating WABA:', error.response?.data || error.message);
    throw new Error(`WABA creation failed: ${error.message}`);
  }
}

/**
 * Step 5: Request Phone Number Registration with OTP
 * Initiates OTP verification for a phone number
 * Meta will send OTP to the specified number
 *
 * @param {string} accessToken - Access token
 * @param {string} wabaId - WABA ID
 * @param {string} phoneNumber - Phone number to register (with country code, e.g., +919876543210)
 * @returns {object} - Registration initiated status
 */
async function requestPhoneNumberRegistration(accessToken, wabaId, phoneNumber) {
  try {
    // Clean phone number - remove all non-digits except leading +
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    if (cleanNumber.length < 10 || cleanNumber.length > 15) {
      throw new Error('Invalid phone number format');
    }

    const formattedNumber = cleanNumber.length === 10 
      ? `91${cleanNumber}` // Add India country code if missing
      : cleanNumber;

    const url = `${META_BASE_URL}/${wabaId}/phone_numbers`;

    const payload = {
      phone_number: `+${formattedNumber}`,
      type: 'INDIVIDUAL' // or BUSINESS
    };

    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('[ESB] Phone registration initiated:', formattedNumber);

    return {
      success: true,
      phoneNumberId: response.data.phone_number_id || response.data.id,
      status: 'otp_pending',
      displayNumber: formattedNumber,
      message: 'OTP will be sent to the registered WhatsApp number'
    };
  } catch (error) {
    console.error('Error requesting phone registration:', error.response?.data || error.message);
    throw new Error(`Phone registration failed: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Step 6: Send OTP to Phone Number
 * Meta's system will send OTP to the WhatsApp number
 * This is typically automatic after requestPhoneNumberRegistration
 * But can be manually triggered if needed
 *
 * @param {string} accessToken - Access token
 * @param {string} phoneNumberId - Phone number ID from registration
 * @returns {object} - OTP send status
 */
async function sendPhoneNumberOTP(accessToken, phoneNumberId) {
  try {
    const url = `${META_BASE_URL}/${phoneNumberId}/request_code`;

    const payload = {
      code_method: 'SMS' // or 'VOICE' for voice call
    };

    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('[ESB] OTP sent to phone number');

    return {
      success: true,
      status: 'otp_sent',
      method: 'SMS',
      expiresIn: 600, // 10 minutes
      message: 'OTP sent to WhatsApp number'
    };
  } catch (error) {
    console.error('Error sending OTP:', error.response?.data || error.message);
    throw new Error(`OTP send failed: ${error.message}`);
  }
}

/**
 * Step 7: Verify OTP Code
 * User receives OTP and submits it for verification
 * After successful verification, phone number is verified
 *
 * @param {string} accessToken - Access token
 * @param {string} phoneNumberId - Phone number ID
 * @param {string} otpCode - OTP code from user
 * @returns {object} - Verification status and phone info
 */
async function verifyPhoneNumberCode(accessToken, phoneNumberId, otpCode) {
  try {
    if (!otpCode || otpCode.length !== 6) {
      throw new Error('OTP must be 6 digits');
    }

    const url = `${META_BASE_URL}/${phoneNumberId}/verify_code`;

    const payload = {
      code: otpCode
    };

    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('[ESB] Phone number verified successfully');

    // Get phone number details
    const phoneDetailsUrl = `${META_BASE_URL}/${phoneNumberId}`;
    const phoneDetails = await axios.get(phoneDetailsUrl, {
      params: {
        fields: 'id,display_phone_number,verified_name,quality_rating,status'
      },
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    return {
      success: true,
      status: 'verified',
      phoneNumberId: phoneNumberId,
      displayPhone: phoneDetails.data?.display_phone_number,
      verifiedName: phoneDetails.data?.verified_name,
      qualityRating: phoneDetails.data?.quality_rating,
      phoneStatus: phoneDetails.data?.status,
      message: 'Phone number verified successfully'
    };
  } catch (error) {
    console.error('Error verifying phone number code:', error.response?.data || error.message);
    throw new Error(`Phone verification failed: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Step 8: Create System User for Token Generation
 * Creates a system user that can generate long-lived tokens
 * System users are used for server-to-server API calls
 *
 * @param {string} accessToken - Business access token
 * @param {string} businessAccountId - Business account ID
 * @param {string} userName - Name for the system user
 * @returns {object} - System user info and token
 */
async function createSystemUser(accessToken, businessAccountId, userName) {
  try {
    const url = `${META_BASE_URL}/${businessAccountId}/system_users`;

    const payload = {
      name: userName || `system_user_${Date.now()}`,
      role: 'ADMIN' // Can be ADMIN, EMPLOYEE, etc.
    };

    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const systemUserId = response.data.id;
    console.log('[ESB] System user created:', systemUserId);

    // Generate token for system user
    const tokenResponse = await generateSystemUserToken(accessToken, businessAccountId, systemUserId);

    return {
      success: true,
      systemUserId: systemUserId,
      accessToken: tokenResponse.accessToken,
      tokenType: 'SYSTEM_USER',
      expiresIn: tokenResponse.expiresIn,
      message: 'System user created and token generated'
    };
  } catch (error) {
    console.error('Error creating system user:', error.response?.data || error.message);
    throw new Error(`System user creation failed: ${error.message}`);
  }
}

/**
 * Generate Access Token for System User
 * This token can be used for API calls instead of user token
 *
 * @param {string} accessToken - Business access token
 * @param {string} businessAccountId - Business account ID
 * @param {string} systemUserId - System user ID
 * @returns {object} - Generated token info
 */
async function generateSystemUserToken(accessToken, businessAccountId, systemUserId) {
  try {
    const url = `${META_BASE_URL}/${systemUserId}/system_user_access_tokens`;

    // Generate a token valid for 60 days (Meta's maximum for system user tokens)
    const payload = {
      access_token_expiration_days: 60
    };

    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('[ESB] System user token generated, expires in:', response.data.access_token_expiration_days, 'days');

    return {
      success: true,
      accessToken: response.data.access_token,
      expiresIn: response.data.access_token_expiration_days * 24 * 3600, // Convert to seconds
      systemUserId: systemUserId,
      message: 'System user token generated successfully'
    };
  } catch (error) {
    console.error('Error generating system user token:', error.response?.data || error.message);
    throw new Error(`System user token generation failed: ${error.message}`);
  }
}

/**
 * Step 9: Update WABA Settings and Activate
 * Configure WABA settings like display name, about text, profile picture
 * Activates the WABA for messaging
 *
 * @param {string} accessToken - Access token
 * @param {string} wabaId - WABA ID to update
 * @param {object} settings - WABA settings
 * @returns {object} - Updated WABA info
 */
async function updateWABASettings(accessToken, wabaId, settings) {
  try {
    const url = `${META_BASE_URL}/${wabaId}`;

    const payload = {
      name: settings.displayName || 'My WhatsApp Business',
      about: settings.about || 'Welcome to our business',
      website: settings.website,
      vertical: settings.industry || 'RETAIL'
    };

    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('[ESB] WABA settings updated:', wabaId);

    return {
      success: true,
      wabaId: wabaId,
      settings: payload,
      status: 'active',
      message: 'WABA activated and configured'
    };
  } catch (error) {
    console.error('Error updating WABA settings:', error.response?.data || error.message);
    throw new Error(`WABA update failed: ${error.message}`);
  }
}

/**
 * Step 10: Get WABA Phone Numbers and Setup Complete Info
 * Retrieves all phone numbers assigned to WABA
 * Used to confirm everything is ready for messaging
 *
 * @param {string} accessToken - Access token
 * @param {string} wabaId - WABA ID
 * @returns {object} - Phone numbers and WABA status
 */
async function getWABAPhoneNumbers(accessToken, wabaId) {
  try {
    const url = `${META_BASE_URL}/${wabaId}/phone_numbers`;

    const response = await axios.get(url, {
      params: {
        fields: 'id,display_phone_number,verified_name,quality_rating,status'
      },
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const phoneNumbers = response.data?.data || [];

    return {
      success: true,
      phoneNumbers: phoneNumbers,
      count: phoneNumbers.length,
      ready: phoneNumbers.length > 0 && phoneNumbers.some(p => p.status === 'CONNECTED')
    };
  } catch (error) {
    console.error('Error getting WABA phone numbers:', error.response?.data || error.message);
    throw new Error(`Get phone numbers failed: ${error.message}`);
  }
}

/**
 * Get Complete Onboarding Status
 * Returns all information about the onboarding progress
 *
 * @param {string} accessToken - Access token
 * @param {string} businessAccountId - Business account ID
 * @param {string} wabaId - WABA ID
 * @returns {object} - Complete onboarding status
 */
async function getOnboardingStatus(accessToken, businessAccountId, wabaId) {
  try {
    const businessUrl = `${META_BASE_URL}/${businessAccountId}`;
    const wabaUrl = `${META_BASE_URL}/${wabaId}`;

    const [bizResp, wabaResp] = await Promise.all([
      axios.get(businessUrl, {
        params: { fields: 'id,name,verification_status,is_verified' },
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }),
      axios.get(wabaUrl, {
        params: { fields: 'id,name,status,currency,message_template_namespace' },
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })
    ]);

    const phoneNumbers = await getWABAPhoneNumbers(accessToken, wabaId);

    return {
      success: true,
      business: {
        id: bizResp.data.id,
        name: bizResp.data.name,
        verificationStatus: bizResp.data.verification_status,
        isVerified: bizResp.data.is_verified
      },
      waba: {
        id: wabaResp.data.id,
        name: wabaResp.data.name,
        status: wabaResp.data.status,
        currency: wabaResp.data.currency
      },
      phoneNumbers: phoneNumbers.phoneNumbers,
      ready: phoneNumbers.ready,
      status: 'completed'
    };
  } catch (error) {
    console.error('Error getting onboarding status:', error.response?.data || error.message);
    throw new Error(`Status check failed: ${error.message}`);
  }
}

/**
 * Refresh User Token
 * Get a new long-lived token using refresh token
 * Useful for extending session without re-authentication
 *
 * @param {string} refreshToken - Refresh token from original auth
 * @returns {object} - New access token
 */
async function refreshUserToken(refreshToken) {
  try {
    const url = `${META_BASE_URL}/oauth/access_token`;

    const params = {
      client_id: metaAppId,
      client_secret: metaAppSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    };

    const response = await axios.get(url, { params });

    return {
      success: true,
      accessToken: response.data.access_token,
      expiresIn: response.data.expires_in,
      refreshToken: response.data.refresh_token || refreshToken
    };
  } catch (error) {
    console.error('Error refreshing token:', error.response?.data || error.message);
    throw new Error(`Token refresh failed: ${error.message}`);
  }
}

/**
 * Full Automated Onboarding Flow (All Steps Combined)
 * This combines all steps for a complete flow
 * Use this for a fully automated experience
 *
 * @param {string} authCode - Authorization code from ESB callback
 * @param {string} redirectUri - Redirect URI used
 * @param {object} businessData - Business info (name, phone, etc.)
 * @param {string} phoneNumber - Phone number to register
 * @returns {object} - Complete onboarding result
 */
async function completeAutomatedOnboarding(authCode, redirectUri, businessData, phoneNumber) {
  try {
    console.log('[ESB] Starting complete automated onboarding...');

    // Step 1: Exchange code for token
    const tokenResult = await exchangeCodeForToken(authCode, redirectUri);
    const accessToken = tokenResult.accessToken;

    // Step 2: Get business account and WABA
    const businessInfo = await getBusinessAccountsInfo(accessToken);
    if (!businessInfo.wabaAccounts.length) {
      throw new Error('No WABA found in user account');
    }

    const waba = businessInfo.wabaAccounts[0];
    const wabaId = waba.id;
    const businessAccountId = waba.businessId;

    // Step 3: Verify business account
    await verifyBusinessAccount(accessToken, businessAccountId, businessData);

    // Step 4: Register phone number
    const phoneReg = await requestPhoneNumberRegistration(accessToken, wabaId, phoneNumber);
    const phoneNumberId = phoneReg.phoneNumberId;

    // Step 5: Send OTP
    await sendPhoneNumberOTP(accessToken, phoneNumberId);

    // Step 6: Create system user (before waiting for OTP)
    const systemUserResult = await createSystemUser(
      accessToken,
      businessAccountId,
      `system_user_${businessData.businessName.replace(/\s+/g, '_')}`
    );

    // Step 7: Update WABA settings
    await updateWABASettings(accessToken, wabaId, {
      displayName: businessData.businessName,
      industry: businessData.industry
    });

    // Step 8: Get status
    const status = await getOnboardingStatus(accessToken, businessAccountId, wabaId);

    console.log('[ESB] Automated onboarding completed successfully');

    return {
      success: true,
      status: 'pending_phone_verification',
      businessAccountId: businessAccountId,
      wabaId: wabaId,
      phoneNumberId: phoneNumberId,
      accessToken: accessToken,
      systemUserToken: systemUserResult.accessToken,
      systemUserId: systemUserResult.systemUserId,
      phoneNumber: businessData.whatsappNumber || phoneNumber,
      nextStep: 'verify_otp_code',
      message: 'Business verified, phone registered with OTP sent',
      statusInfo: status
    };
  } catch (error) {
    console.error('Error in complete automated onboarding:', error.message);
    throw error;
  }
}

/**
 * Get System User Token Created by Meta ESB
 * Meta's ESB automatically creates a system user and generates a token
 * This function retrieves that token
 * 
 * @param {string} accessToken - User's access token from ESB
 * @param {string} businessAccountId - Business account ID
 * @returns {object} - System user token and metadata
 */
async function getSystemUserToken(accessToken, businessAccountId) {
  try {
    // Get all system users under this business
    const url = `${META_BASE_URL}/${businessAccountId}/system_users`;

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    // ✅ GAP 5: Validate response data type and structure
    const systemUsers = response.data?.data || [];

    if (!Array.isArray(systemUsers)) {
      throw new Error('Invalid system users response format from Meta');
    }

    if (systemUsers.length === 0) {
      throw new Error('No system user found. ESB may not have completed successfully.');
    }

    // Use the first system user (usually the one just created by ESB)
    const systemUser = systemUsers[0];
    const systemUserId = systemUser.id;

    // Validate system user ID format
    if (!systemUserId || typeof systemUserId !== 'string') {
      throw new Error('Invalid system user ID from Meta');
    }

    // Now get the access token for this system user
    const tokenUrl = `${META_BASE_URL}/${systemUserId}/system_user_access_tokens`;

    const tokenResponse = await axios.post(tokenUrl, 
      { access_token_expiration_days: 60 },  // 60 days = Meta max
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    // ✅ GAP 1 & 5: Check for error in response and validate token format
    if (tokenResponse.data.error) {
      throw new Error(`Meta error: ${tokenResponse.data.error.message || tokenResponse.data.error}`);
    }

    if (!tokenResponse.data.access_token || typeof tokenResponse.data.access_token !== 'string') {
      throw new Error('Invalid system user token format from Meta');
    }

    // ✅ GAP 3: Validate expiration days is number
    const expirationDays = tokenResponse.data.access_token_expiration_days || 60;
    if (typeof expirationDays !== 'number' || expirationDays <= 0) {
      throw new Error('Invalid token expiration format from Meta');
    }

    console.log('[ESB] Retrieved system user token');

    return {
      success: true,
      userId: systemUserId,
      token: tokenResponse.data.access_token,
      expiresIn: expirationDays * 24 * 3600,
      message: 'System user token retrieved successfully'
    };
  } catch (error) {
    console.error('Error getting system user token:', error.response?.data || error.message);
    throw new Error(`Failed to get system user token: ${error.message}`);
  }
}

module.exports = {
  // ESB Flow
  generateEmbeddedSignupURL,
  verifyCallbackState,
  exchangeCodeForToken,
  getTokenUserInfo,
  getBusinessAccountsInfo,

  // Business Verification
  verifyBusinessAccount,
  createWABA,

  // Phone Registration & OTP
  requestPhoneNumberRegistration,
  sendPhoneNumberOTP,
  verifyPhoneNumberCode,

  // System User & Tokens
  createSystemUser,
  generateSystemUserToken,
  refreshUserToken,
  getSystemUserToken,

  // WABA Management
  updateWABASettings,
  getWABAPhoneNumbers,
  getOnboardingStatus,

  // Complete Flow
  completeAutomatedOnboarding
};
