const axios = require('axios');
const crypto = require('crypto');
const Workspace = require('../models/Workspace');
const bspConfig = require('../config/bspConfig');









































































































const META_API_VERSION = 'v21.0';
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

/**
 * Send a text message via WhatsApp Cloud API
 */
async function sendTextMessage(accessToken, phoneNumberId, to, text) {
  const url = `${META_BASE_URL}/${phoneNumberId}/messages`;
  
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: to,
    type: 'text',
    text: { body: text }
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    return {
      success: true,
      messageId: response.data.messages?.[0]?.id,
      data: response.data
    };
  } catch (error) {
    console.error('Meta API error (sendTextMessage):', error.response?.data || error.message);
    
    // Check for token errors
    if (error.response?.status === 401 || error.response?.data?.error?.code === 190) {
      throw new Error('TOKEN_EXPIRED');
    }
    
    throw new Error(error.response?.data?.error?.message || error.message);
  }
}

/**
 * Send a template message via WhatsApp Cloud API
 */
async function sendTemplateMessage(accessToken, phoneNumberId, to, templateName, languageCode = 'en', components = []) {
  const url = `${META_BASE_URL}/${phoneNumberId}/messages`;
  
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components: components
    }
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    return {
      success: true,
      messageId: response.data.messages?.[0]?.id,
      data: response.data
    };
  } catch (error) {
    console.error('Meta API error (sendTemplateMessage):', error.response?.data || error.message);
    
    if (error.response?.status === 401 || error.response?.data?.error?.code === 190) {
      throw new Error('TOKEN_EXPIRED');
    }
    
    throw new Error(error.response?.data?.error?.message || error.message);
  }
}

/**
 * Fetch all templates for a WABA
 */
async function fetchTemplates(accessToken, wabaId, limit = 100) {
  const url = `${META_BASE_URL}/${wabaId}/message_templates`;
  
  try {
    const response = await axios.get(url, {
      params: {
        limit: limit,
        fields: 'name,language,status,category,components,rejected_reason,quality_score'
      },
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    return {
      success: true,
      templates: response.data.data || [],
      paging: response.data.paging
    };
  } catch (error) {
    console.error('Meta API error (fetchTemplates):', error.response?.data || error.message);
    
    if (error.response?.status === 401 || error.response?.data?.error?.code === 190) {
      throw new Error('TOKEN_EXPIRED');
    }
    
    throw new Error(error.response?.data?.error?.message || error.message);
  }
}

/**
 * Create/Submit a template to Meta
 */
async function submitTemplate(accessToken, wabaId, templateData) {
  const url = `${META_BASE_URL}/${wabaId}/message_templates`;
  
  const payload = {
    name: templateData.name,
    language: templateData.language || 'en',
    category: templateData.category || 'MARKETING',
    components: templateData.components || []
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    return {
      success: true,
      templateId: response.data.id,
      status: response.data.status,
      data: response.data
    };
  } catch (error) {
    console.error('Meta API error (submitTemplate):', error.response?.data || error.message);
    
    if (error.response?.status === 401 || error.response?.data?.error?.code === 190) {
      throw new Error('TOKEN_EXPIRED');
    }
    
    // Template submission often requires Business Manager approval
    if (error.response?.status === 403) {
      throw new Error('REQUIRES_BUSINESS_MANAGER');
    }
    
    throw new Error(error.response?.data?.error?.message || error.message);
  }
}

/**
 * Delete a template
 */
async function deleteTemplate(accessToken, wabaId, templateName) {
  const url = `${META_BASE_URL}/${wabaId}/message_templates`;
  
  try {
    const response = await axios.delete(url, {
      params: { name: templateName },
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('Meta API error (deleteTemplate):', error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.message || error.message);
  }
}

/**
 * Verify webhook signature from Meta
 */
function verifyWebhookSignature(requestBody, signatureHeader, appSecret) {
  if (!signatureHeader) {
    return false;
  }

  // Extract signature (format: sha256=<signature>)
  const signatureParts = signatureHeader.split('=');
  if (signatureParts.length !== 2 || signatureParts[0] !== 'sha256') {
    return false;
  }

  const signature = signatureParts[1];
  
  // Calculate expected signature
  const expectedSignature = crypto
    .createHmac('sha256', appSecret)
    .update(requestBody)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'utf-8'),
    Buffer.from(expectedSignature, 'utf-8')
  );
}

/**
 * Mark messages as read
 */
async function markMessageAsRead(accessToken, phoneNumberId, messageId) {
  const url = `${META_BASE_URL}/${phoneNumberId}/messages`;
  
  const payload = {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('Meta API error (markMessageAsRead):', error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.message || error.message);
  }
}

/**
 * Get media URL (for images, videos, etc.)
 */
async function getMediaUrl(accessToken, mediaId) {
  const url = `${META_BASE_URL}/${mediaId}`;
  
  try {
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    return {
      success: true,
      url: response.data.url,
      mimeType: response.data.mime_type,
      sha256: response.data.sha256,
      fileSize: response.data.file_size
    };
  } catch (error) {
    console.error('Meta API error (getMediaUrl):', error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.message || error.message);
  }
}

/**
 * Submit business information for verification (best-effort wrapper).
 * Note: Business verification via Meta requires specific permissions and Business Manager access.
 * This helper attempts to create a verification request on the business account.
 */
async function submitBusinessInfo(accessToken, businessAccountId, businessData) {
  // Endpoint and payload may vary depending on Meta API version and permissions.
  const url = `${META_BASE_URL}/${businessAccountId}/business_verification_requests`;

  try {
    const response = await axios.post(url, businessData, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('Meta API error (submitBusinessInfo):', error.response?.data || error.message);
    if (error.response?.status === 401 || error.response?.data?.error?.code === 190) {
      throw new Error('TOKEN_EXPIRED');
    }
    // Bubble up the API error message when possible
    throw new Error(error.response?.data?.error?.message || error.message);
  }
}

/**
 * Submit official business documents for verification (GST, MSME, etc.)
 * This submits business verification documents to Meta for review
 */
async function submitBusinessVerification(accessToken, businessAccountId, verificationData) {
  const url = `${META_BASE_URL}/${businessAccountId}`;
  
  // Build the verification payload with official documents
  const payload = {
    // Business details
    name: verificationData.businessName,
    vertical: verificationData.industry,
    
    // Address details
    address: {
      city: verificationData.city,
      country_code: verificationData.countryCode || 'IN',
      region: verificationData.state,
      street: verificationData.address,
      zip: verificationData.zipCode
    },
    
    // Website
    website: verificationData.website,
    
    // Official document information
    // For Indian businesses, this includes GST or MSME registration
    additional_information: JSON.stringify({
      document_type: verificationData.documentType,
      document_number: verificationData.documentNumber,
      gst_number: verificationData.gstNumber,
      msme_number: verificationData.msmeNumber,
      pan_number: verificationData.panNumber
    })
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    return {
      success: true,
      verificationId: response.data.id,
      status: 'pending',
      data: response.data
    };
  } catch (error) {
    console.error('Meta API error (submitBusinessVerification):', error.response?.data || error.message);
    if (error.response?.status === 401 || error.response?.data?.error?.code === 190) {
      throw new Error('TOKEN_EXPIRED');
    }
    throw new Error(error.response?.data?.error?.message || error.message);
  }
}

/**
 * Get business verification status from Meta
 * Returns the current verification status of the business account
 */
async function getBusinessVerificationStatus(accessToken, businessAccountId) {
  const url = `${META_BASE_URL}/${businessAccountId}`;
  
  try {
    const response = await axios.get(url, {
      params: {
        fields: 'id,name,verification_status,is_verified,primary_page,business_type'
      },
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    // Map Meta's verification status to our status
    let status = 'not_submitted';
    if (response.data.is_verified) {
      status = 'verified';
    } else if (response.data.verification_status === 'pending') {
      status = 'pending';
    } else if (response.data.verification_status === 'in_review') {
      status = 'in_review';
    } else if (response.data.verification_status === 'rejected') {
      status = 'rejected';
    } else if (response.data.verification_status === 'verified') {
      status = 'verified';
    }

    return {
      success: true,
      status: status,
      isVerified: response.data.is_verified || false,
      businessType: response.data.business_type,
      data: response.data
    };
  } catch (error) {
    console.error('Meta API error (getBusinessVerificationStatus):', error.response?.data || error.message);
    if (error.response?.status === 401 || error.response?.data?.error?.code === 190) {
      throw new Error('TOKEN_EXPIRED');
    }
    throw new Error(error.response?.data?.error?.message || error.message);
  }
}

/**
 * Debug function to verify token and get associated WABA info
 * This helps diagnose permission and ID issues
 */
async function debugTokenInfo(accessToken) {
  const results = {
    tokenValid: false,
    appInfo: null,
    businessAccounts: [],
    wabaAccounts: [],
    phoneNumbers: [],
    errors: []
  };

  try {
    // 1. Check token validity and get app info
    const tokenDebugUrl = `${META_BASE_URL}/debug_token`;
    try {
      const tokenResp = await axios.get(tokenDebugUrl, {
        params: {
          input_token: accessToken,
          access_token: accessToken
        }
      });
      results.tokenValid = tokenResp.data?.data?.is_valid || false;
      results.appInfo = {
        appId: tokenResp.data?.data?.app_id,
        type: tokenResp.data?.data?.type,
        expiresAt: tokenResp.data?.data?.expires_at,
        scopes: tokenResp.data?.data?.scopes
      };
    } catch (e) {
      results.errors.push({ step: 'token_debug', error: e.response?.data?.error?.message || e.message });
    }

    // 2. Get user's business accounts
    const meUrl = `${META_BASE_URL}/me/businesses`;
    try {
      const bizResp = await axios.get(meUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      results.businessAccounts = bizResp.data?.data || [];
    } catch (e) {
      results.errors.push({ step: 'businesses', error: e.response?.data?.error?.message || e.message });
    }

    // 3. Try to get WABA accounts from each business
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
        }
      } catch (e) {
        results.errors.push({ step: `waba_for_${biz.id}`, error: e.response?.data?.error?.message || e.message });
      }
    }

    // 4. If we have a phone number ID in env, try to get its WABA
    const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
    if (phoneNumberId) {
      try {
        const phoneUrl = `${META_BASE_URL}/${phoneNumberId}`;
        const phoneResp = await axios.get(phoneUrl, {
          params: { fields: 'display_phone_number,verified_name,id' },
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        results.phoneNumbers.push({
          id: phoneNumberId,
          displayNumber: phoneResp.data?.display_phone_number,
          verifiedName: phoneResp.data?.verified_name
        });
      } catch (e) {
        results.errors.push({ step: 'phone_number', error: e.response?.data?.error?.message || e.message });
      }
    }

  } catch (error) {
    results.errors.push({ step: 'general', error: error.message });
  }

  return results;
}

/**
 * Get the correct WABA ID from a phone number
 */
async function getWABAFromPhoneNumber(accessToken, phoneNumberId) {
  try {
    // First get the phone number info
    const phoneUrl = `${META_BASE_URL}/${phoneNumberId}`;
    const phoneResp = await axios.get(phoneUrl, {
      params: { fields: 'id,display_phone_number,verified_name' },
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    // Try to get the WhatsApp Business Account ID from the phone number's parent
    // The WABA ID should be obtainable via the phone_number's owning business account
    const whatsappBusinessAccountUrl = `${META_BASE_URL}/${phoneNumberId}?fields=id,display_phone_number,whatsapp_business_account`;
    const wabaResp = await axios.get(whatsappBusinessAccountUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    return {
      phoneNumber: phoneResp.data,
      wabaId: wabaResp.data?.whatsapp_business_account?.id || null
    };
  } catch (error) {
    console.error('Error getting WABA from phone number:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.message || error.message);
  }
}

/**
 * Exchange short-lived access token for long-lived token
 * This is essential for Embedded Signup to get a persistent token
 */
async function exchangeToken(shortLivedToken, appId, appSecret) {
  const url = `${META_BASE_URL}/oauth/access_token`;
  
  try {
    const response = await axios.get(url, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: shortLivedToken
      }
    });
    
    return {
      success: true,
      accessToken: response.data.access_token,
      tokenType: response.data.token_type,
      expiresIn: response.data.expires_in
    };
  } catch (error) {
    console.error('Token exchange error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.message || 'Failed to exchange token');
  }
}

/**
 * Get all phone numbers for a WABA
 * Essential for Embedded Signup to retrieve connected phone numbers
 */
async function getWABAPhoneNumbers(accessToken, wabaId) {
  const url = `${META_BASE_URL}/${wabaId}/phone_numbers`;
  
  try {
    const response = await axios.get(url, {
      params: {
        fields: 'id,display_phone_number,verified_name,quality_rating,status,name_status,code_verification_status'
      },
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    const phoneNumbers = (response.data?.data || []).map(phone => ({
      id: phone.id,
      displayPhoneNumber: phone.display_phone_number,
      verifiedName: phone.verified_name,
      qualityRating: phone.quality_rating,
      status: phone.status,
      nameStatus: phone.name_status,
      codeVerificationStatus: phone.code_verification_status
    }));
    
    return {
      success: true,
      phoneNumbers: phoneNumbers,
      count: phoneNumbers.length
    };
  } catch (error) {
    console.error('Error getting WABA phone numbers:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.message || error.message);
  }
}

/**
 * Get details of a specific phone number
 */
async function getPhoneNumberInfo(accessToken, phoneNumberId) {
  const url = `${META_BASE_URL}/${phoneNumberId}`;
  
  try {
    const response = await axios.get(url, {
      params: {
        fields: 'id,display_phone_number,verified_name,quality_rating,status,name_status,code_verification_status,certificate,is_official_business_account'
      },
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    return {
      success: true,
      id: response.data.id,
      displayNumber: response.data.display_phone_number,
      verifiedName: response.data.verified_name,
      qualityRating: response.data.quality_rating,
      status: response.data.status,
      nameStatus: response.data.name_status,
      codeVerificationStatus: response.data.code_verification_status,
      isOfficialBusinessAccount: response.data.is_official_business_account
    };
  } catch (error) {
    console.error('Error getting phone number info:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.message || error.message);
  }
}

/**
 * Lookup WhatsApp profile for an arbitrary phone using the WABA phone number
 * This calls the Cloud API: POST /{WABA_PHONE_NUMBER_ID}/contacts with the target phone
 */
async function lookupContactProfile(accessToken, wabaPhoneNumberId, phone) {
  const url = `${META_BASE_URL}/${wabaPhoneNumberId}/contacts`;

  try {
    const response = await axios.post(url, {
      blocking: 'wait',
      contacts: [{ input: phone }]
    }, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    // Response should contain contacts array
    const contactInfo = response.data?.contacts && response.data.contacts[0] ? response.data.contacts[0] : null;

    return {
      success: true,
      contact: contactInfo,
      raw: response.data
    };
  } catch (error) {
    console.error('Error looking up contact profile:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.message || error.message);
  }
}

/**
 * Register a phone number with WhatsApp Business API
 * This is used for manual phone number registration flow
 */
async function registerPhoneNumber(accessToken, phoneNumberId, pin) {
  const url = `${META_BASE_URL}/${phoneNumberId}/register`;
  
  try {
    const response = await axios.post(url, {
      messaging_product: 'whatsapp',
      pin: pin // 6-digit PIN for two-step verification
    }, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    return {
      success: response.data.success || true,
      data: response.data
    };
  } catch (error) {
    console.error('Phone registration error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.message || error.message);
  }
}

/**
 * Request verification code for a phone number
 * Sends OTP via SMS or voice call
 */
async function requestPhoneVerification(accessToken, phoneNumberId, codeMethod = 'SMS', language = 'en') {
  const url = `${META_BASE_URL}/${phoneNumberId}/request_code`;
  
  try {
    const response = await axios.post(url, {
      code_method: codeMethod, // SMS or VOICE
      language: language
    }, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    return {
      success: response.data.success || true,
      data: response.data
    };
  } catch (error) {
    console.error('Phone verification request error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.message || error.message);
  }
}

/**
 * Verify phone number with code
 * Completes phone verification with the OTP received
 */
async function verifyPhoneCode(accessToken, phoneNumberId, code) {
  const url = `${META_BASE_URL}/${phoneNumberId}/verify_code`;
  
  try {
    const response = await axios.post(url, {
      code: code
    }, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    return {
      success: response.data.success || true,
      data: response.data
    };
  } catch (error) {
    console.error('Phone verification error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.message || error.message);
  }
}

/**
 * Remove emojis and special characters from header text
 * Meta doesn't allow emojis, newlines, formatting characters, or asterisks in headers
 */
function sanitizeHeaderText(text) {
  if (!text) return '';
  
  // Remove emojis (comprehensive emoji regex)
  let sanitized = text.replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Misc Symbols and Pictographs
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport and Map
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // Flags
    .replace(/[\u{2600}-\u{26FF}]/gu, '')   // Misc symbols
    .replace(/[\u{2700}-\u{27BF}]/gu, '')   // Dingbats
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')   // Variation Selectors
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // Supplemental Symbols and Pictographs
    .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '') // Chess Symbols
    .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '') // Symbols and Pictographs Extended-A
    .replace(/[\u{231A}-\u{231B}]/gu, '')   // Watch, Hourglass
    .replace(/[\u{23E9}-\u{23F3}]/gu, '')   // Various symbols
    .replace(/[\u{23F8}-\u{23FA}]/gu, '')   // Various symbols
    .replace(/[\u{25AA}-\u{25AB}]/gu, '')   // Squares
    .replace(/[\u{25B6}]/gu, '')            // Play button
    .replace(/[\u{25C0}]/gu, '')            // Reverse button
    .replace(/[\u{25FB}-\u{25FE}]/gu, '')   // Squares
    .replace(/[\u{2614}-\u{2615}]/gu, '')   // Umbrella, Coffee
    .replace(/[\u{2648}-\u{2653}]/gu, '')   // Zodiac
    .replace(/[\u{267F}]/gu, '')            // Wheelchair
    .replace(/[\u{2693}]/gu, '')            // Anchor
    .replace(/[\u{26A1}]/gu, '')            // High Voltage
    .replace(/[\u{26AA}-\u{26AB}]/gu, '')   // Circles
    .replace(/[\u{26BD}-\u{26BE}]/gu, '')   // Soccer, Baseball
    .replace(/[\u{26C4}-\u{26C5}]/gu, '')   // Snowman, Sun
    .replace(/[\u{26CE}]/gu, '')            // Ophiuchus
    .replace(/[\u{26D4}]/gu, '')            // No Entry
    .replace(/[\u{26EA}]/gu, '')            // Church
    .replace(/[\u{26F2}-\u{26F3}]/gu, '')   // Fountain, Golf
    .replace(/[\u{26F5}]/gu, '')            // Sailboat
    .replace(/[\u{26FA}]/gu, '')            // Tent
    .replace(/[\u{26FD}]/gu, '')            // Fuel Pump
    .replace(/[\u{2702}]/gu, '')            // Scissors
    .replace(/[\u{2705}]/gu, '')            // Check Mark
    .replace(/[\u{2708}-\u{270D}]/gu, '')   // Airplane to Writing Hand
    .replace(/[\u{270F}]/gu, '')            // Pencil
    .replace(/[\u{2712}]/gu, '')            // Black Nib
    .replace(/[\u{2714}]/gu, '')            // Check Mark
    .replace(/[\u{2716}]/gu, '')            // X Mark
    .replace(/[\u{271D}]/gu, '')            // Latin Cross
    .replace(/[\u{2721}]/gu, '')            // Star of David
    .replace(/[\u{2728}]/gu, '')            // Sparkles
    .replace(/[\u{2733}-\u{2734}]/gu, '')   // Eight Spoked Asterisk
    .replace(/[\u{2744}]/gu, '')            // Snowflake
    .replace(/[\u{2747}]/gu, '')            // Sparkle
    .replace(/[\u{274C}]/gu, '')            // Cross Mark
    .replace(/[\u{274E}]/gu, '')            // Cross Mark
    .replace(/[\u{2753}-\u{2755}]/gu, '')   // Question Marks
    .replace(/[\u{2757}]/gu, '')            // Exclamation Mark
    .replace(/[\u{2763}-\u{2764}]/gu, '')   // Heart Exclamation, Heart
    .replace(/[\u{2795}-\u{2797}]/gu, '')   // Plus, Minus, Divide
    .replace(/[\u{27A1}]/gu, '')            // Right Arrow
    .replace(/[\u{27B0}]/gu, '')            // Curly Loop
    .replace(/[\u{27BF}]/gu, '')            // Double Curly Loop
    .replace(/[\u{2934}-\u{2935}]/gu, '')   // Arrows
    .replace(/[\u{2B05}-\u{2B07}]/gu, '')   // Arrows
    .replace(/[\u{2B1B}-\u{2B1C}]/gu, '')   // Squares
    .replace(/[\u{2B50}]/gu, '')            // Star
    .replace(/[\u{2B55}]/gu, '')            // Circle
    .replace(/[\u{3030}]/gu, '')            // Wavy Dash
    .replace(/[\u{303D}]/gu, '')            // Part Alternation Mark
    .replace(/[\u{3297}]/gu, '')            // Circled Ideograph Congratulation
    .replace(/[\u{3299}]/gu, '');           // Circled Ideograph Secret
  
  // Remove newlines, asterisks, and formatting characters
  sanitized = sanitized
    .replace(/\n/g, ' ')
    .replace(/\r/g, '')
    .replace(/\*/g, '')
    .replace(/_/g, '')
    .replace(/~/g, '')
    .replace(/`/g, '');
  
  // Trim and remove extra spaces
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  
  return sanitized;
}

module.exports = {
  sendTextMessage,
  sendTemplateMessage,
  fetchTemplates,
  submitTemplate,
  deleteTemplate,
  verifyWebhookSignature,
  markMessageAsRead,
  getMediaUrl,
  submitBusinessInfo,
  submitBusinessVerification,
  getBusinessVerificationStatus,
  debugTokenInfo,
  getWABAFromPhoneNumber,
  exchangeToken,
  getWABAPhoneNumbers,
  getPhoneNumberInfo,
  registerPhoneNumber,
  requestPhoneVerification,
  verifyPhoneCode
};
