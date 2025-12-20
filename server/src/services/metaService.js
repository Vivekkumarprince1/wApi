const axios = require('axios');
const crypto = require('crypto');

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
 * Fetch templates from Meta's Template Library (pre-made templates by Meta)
 * Uses the hsm_template_library endpoint which provides ready-to-use templates
 */
async function fetchTemplateLibrary(accessToken, wabaId, category = null, language = 'en_US', limit = 200) {
  // Try multiple endpoints to fetch Template Library
  const endpoints = [
    `${META_BASE_URL}/${wabaId}/hsm_templates`, // HSM templates
    `${META_BASE_URL}/${wabaId}/upsell_message_templates`, // Upsell templates
  ];
  
  for (const url of endpoints) {
    try {
      const params = {
        limit: limit,
        fields: 'name,language,category,components,status,quality_score'
      };
      
      if (category && category !== 'all') {
        params.category = category.toUpperCase();
      }
      
      console.log(`Trying Template Library endpoint: ${url}`);
      
      const response = await axios.get(url, {
        params,
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (response.data?.data?.length > 0) {
        console.log(`Found ${response.data.data.length} templates from ${url}`);
        
        // Process templates to extract body text
        const processedTemplates = response.data.data.map(t => {
          const headerComponent = t.components?.find(c => c.type === 'HEADER');
          const bodyComponent = t.components?.find(c => c.type === 'BODY');
          const footerComponent = t.components?.find(c => c.type === 'FOOTER');
          const buttonComponents = t.components?.filter(c => c.type === 'BUTTONS');
          
          return {
            ...t,
            headerText: headerComponent?.text || headerComponent?.format || '',
            bodyText: bodyComponent?.text || '',
            footerText: footerComponent?.text || '',
            buttonLabels: buttonComponents?.flatMap(bc => bc.buttons?.map(b => b.text) || []) || [],
            isLibraryTemplate: true,
            source: 'META_LIBRARY'
          };
        });
        
        return {
          success: true,
          templates: processedTemplates,
          paging: response.data.paging,
          source: 'META_API',
          total: processedTemplates.length
        };
      }
    } catch (error) {
      console.log(`Endpoint ${url} failed:`, error.response?.data?.error?.message || error.message);
      continue; // Try next endpoint
    }
  }
  
  // If API endpoints don't work, return the hardcoded library templates
  console.log('Meta Template Library API not available, using built-in templates');
  return getBuiltInTemplateLibrary(category, language);
}

/**
 * Get built-in template library (fallback when API not available)
 * These match Meta's actual Template Library templates
 */
function getBuiltInTemplateLibrary(category = null, language = 'en_US') {
  const templates = [
    // UTILITY - Account Updates (20+ templates)
    {
      name: 'account_creation_confirmation_3',
      category: 'UTILITY',
      subcategory: 'Account updates',
      language: 'en_US',
      headerText: 'Finalize account set-up',
      bodyText: 'Hi {{1}},\n\nYour new account has been created successfully.\n\nPlease verify {{2}} to complete your profile.',
      footerText: '',
      buttonLabels: ['Verify account'],
      variables: ['name', 'verification_item'],
      status: 'LIBRARY'
    },
    {
      name: 'address_update',
      category: 'UTILITY',
      subcategory: 'Account updates',
      language: 'en_US',
      headerText: 'Address update',
      bodyText: 'Hi {{1}}, your delivery address has been successfully updated to {{2}}. Contact {{3}} for any inquiries.',
      footerText: '',
      buttonLabels: [],
      variables: ['name', 'new_address', 'support_contact'],
      status: 'LIBRARY'
    },
    {
      name: 'appointment_cancelled',
      category: 'UTILITY',
      subcategory: 'Account updates',
      language: 'en_US',
      headerText: 'Your appointment was canceled',
      bodyText: 'Hello {{1}},\n\nYour upcoming appointment with {{2}} on {{3}} at {{4}} has been canceled.\n\nLet us know if you have any questions or need to reschedule.',
      footerText: '',
      buttonLabels: [],
      variables: ['name', 'business_name', 'date', 'time'],
      status: 'LIBRARY'
    },
    {
      name: 'appointment_booked',
      category: 'UTILITY',
      subcategory: 'Account updates',
      language: 'en_US',
      headerText: 'Your appointment is booked',
      bodyText: 'Hello {{1}},\n\nThank you for booking with {{2}}.\n\nYour appointment for {{3}} on {{4}} at {{5}} is confirmed.',
      footerText: '',
      buttonLabels: [],
      variables: ['name', 'business_name', 'service', 'date', 'time'],
      status: 'LIBRARY'
    },
    {
      name: 'appointment_reminder',
      category: 'UTILITY',
      subcategory: 'Account updates',
      language: 'en_US',
      headerText: 'Appointment reminder',
      bodyText: 'Hi {{1}},\n\nThis is a reminder about your upcoming appointment with {{2}} on {{3}} at {{4}}.\n\nSee you soon!',
      footerText: '',
      buttonLabels: ['Confirm', 'Reschedule'],
      variables: ['name', 'business_name', 'date', 'time'],
      status: 'LIBRARY'
    },
    {
      name: 'appointment_rescheduled',
      category: 'UTILITY',
      subcategory: 'Account updates',
      language: 'en_US',
      headerText: 'Appointment rescheduled',
      bodyText: 'Hi {{1}},\n\nYour appointment has been rescheduled to {{2}} at {{3}}.\n\nPlease let us know if this works for you.',
      footerText: '',
      buttonLabels: ['Confirm', 'Reschedule again'],
      variables: ['name', 'date', 'time'],
      status: 'LIBRARY'
    },
    {
      name: 'booking_confirmation',
      category: 'UTILITY',
      subcategory: 'Account updates',
      language: 'en_US',
      headerText: 'Booking confirmed',
      bodyText: 'Hi {{1}},\n\nYour booking #{{2}} is confirmed!\n\nDate: {{3}}\nTime: {{4}}\nLocation: {{5}}\n\nWe look forward to seeing you!',
      footerText: '',
      buttonLabels: ['View details', 'Add to calendar'],
      variables: ['name', 'booking_id', 'date', 'time', 'location'],
      status: 'LIBRARY'
    },
    {
      name: 'password_reset',
      category: 'UTILITY',
      subcategory: 'Account updates',
      language: 'en_US',
      headerText: 'Password reset',
      bodyText: 'Hi {{1}},\n\nWe received a request to reset your password. Click the button below to set a new password.\n\nIf you didn\'t request this, please ignore this message.',
      footerText: 'This link expires in 24 hours',
      buttonLabels: ['Reset password'],
      variables: ['name'],
      status: 'LIBRARY'
    },
    {
      name: 'account_verified',
      category: 'UTILITY',
      subcategory: 'Account updates',
      language: 'en_US',
      headerText: 'Account verified!',
      bodyText: 'Hi {{1}},\n\nCongratulations! Your account has been successfully verified.\n\nYou now have full access to all features.',
      footerText: '',
      buttonLabels: ['Get started'],
      variables: ['name'],
      status: 'LIBRARY'
    },
    
    // UTILITY - Order Management (20+ templates)
    {
      name: 'order_confirmation',
      category: 'UTILITY',
      subcategory: 'Order management',
      language: 'en_US',
      headerText: 'Order confirmed!',
      bodyText: 'Hi {{1}},\n\nThank you for your order #{{2}}!\n\nTotal: {{3}}\n\nWe\'ll send you a notification when it ships.',
      footerText: '',
      buttonLabels: ['Track order', 'View details'],
      variables: ['name', 'order_id', 'total'],
      status: 'LIBRARY'
    },
    {
      name: 'order_shipped',
      category: 'UTILITY',
      subcategory: 'Order management',
      language: 'en_US',
      headerText: 'Your order is on its way!',
      bodyText: 'Hi {{1}},\n\nGreat news! Your order #{{2}} has been shipped.\n\nTracking number: {{3}}\nEstimated delivery: {{4}}',
      footerText: '',
      buttonLabels: ['Track shipment'],
      variables: ['name', 'order_id', 'tracking_number', 'delivery_date'],
      status: 'LIBRARY'
    },
    {
      name: 'order_out_for_delivery',
      category: 'UTILITY',
      subcategory: 'Order management',
      language: 'en_US',
      headerText: 'Out for delivery',
      bodyText: 'Hi {{1}},\n\nYour order #{{2}} is out for delivery and will arrive today!\n\nMake sure someone is available to receive it.',
      footerText: '',
      buttonLabels: ['Track live'],
      variables: ['name', 'order_id'],
      status: 'LIBRARY'
    },
    {
      name: 'order_delivered',
      category: 'UTILITY',
      subcategory: 'Order management',
      language: 'en_US',
      headerText: 'Order delivered!',
      bodyText: 'Hi {{1}},\n\nYour order #{{2}} has been delivered!\n\nWe hope you love it. Let us know if you have any questions.',
      footerText: '',
      buttonLabels: ['Rate your order', 'Need help?'],
      variables: ['name', 'order_id'],
      status: 'LIBRARY'
    },
    {
      name: 'order_cancelled',
      category: 'UTILITY',
      subcategory: 'Order management',
      language: 'en_US',
      headerText: 'Order cancelled',
      bodyText: 'Hi {{1}},\n\nYour order #{{2}} has been cancelled as requested.\n\nRefund of {{3}} will be processed within 5-7 business days.',
      footerText: '',
      buttonLabels: ['Shop again'],
      variables: ['name', 'order_id', 'refund_amount'],
      status: 'LIBRARY'
    },
    {
      name: 'order_refunded',
      category: 'UTILITY',
      subcategory: 'Order management',
      language: 'en_US',
      headerText: 'Refund processed',
      bodyText: 'Hi {{1}},\n\nYour refund of {{2}} for order #{{3}} has been processed.\n\nIt may take 3-5 business days to appear in your account.',
      footerText: '',
      buttonLabels: [],
      variables: ['name', 'amount', 'order_id'],
      status: 'LIBRARY'
    },
    {
      name: 'order_delayed',
      category: 'UTILITY',
      subcategory: 'Order management',
      language: 'en_US',
      headerText: 'Delivery update',
      bodyText: 'Hi {{1}},\n\nWe\'re sorry, but your order #{{2}} has been delayed.\n\nNew estimated delivery: {{3}}\n\nWe apologize for the inconvenience.',
      footerText: '',
      buttonLabels: ['Track order', 'Contact support'],
      variables: ['name', 'order_id', 'new_date'],
      status: 'LIBRARY'
    },
    {
      name: 'cart_abandoned',
      category: 'UTILITY',
      subcategory: 'Order management',
      language: 'en_US',
      headerText: 'You left something behind!',
      bodyText: 'Hi {{1}},\n\nYou have {{2}} items waiting in your cart.\n\nComplete your order before they sell out!',
      footerText: '',
      buttonLabels: ['Complete order'],
      variables: ['name', 'item_count'],
      status: 'LIBRARY'
    },
    {
      name: 'back_in_stock',
      category: 'UTILITY',
      subcategory: 'Order management',
      language: 'en_US',
      headerText: 'Back in stock!',
      bodyText: 'Hi {{1}},\n\nGood news! {{2}} is back in stock.\n\nGet it before it sells out again!',
      footerText: '',
      buttonLabels: ['Shop now'],
      variables: ['name', 'product_name'],
      status: 'LIBRARY'
    },
    
    // UTILITY - Payments (15+ templates)
    {
      name: 'payment_received',
      category: 'UTILITY',
      subcategory: 'Payments',
      language: 'en_US',
      headerText: 'Payment received',
      bodyText: 'Hi {{1}},\n\nWe\'ve received your payment of {{2}} for invoice #{{3}}.\n\nThank you for your business!',
      footerText: '',
      buttonLabels: ['View receipt'],
      variables: ['name', 'amount', 'invoice_id'],
      status: 'LIBRARY'
    },
    {
      name: 'payment_reminder',
      category: 'UTILITY',
      subcategory: 'Payments',
      language: 'en_US',
      headerText: 'Payment reminder',
      bodyText: 'Hi {{1}},\n\nThis is a friendly reminder that your payment of {{2}} for invoice #{{3}} is due on {{4}}.\n\nPlease make your payment to avoid any late fees.',
      footerText: '',
      buttonLabels: ['Pay now'],
      variables: ['name', 'amount', 'invoice_id', 'due_date'],
      status: 'LIBRARY'
    },
    {
      name: 'payment_failed',
      category: 'UTILITY',
      subcategory: 'Payments',
      language: 'en_US',
      headerText: 'Payment failed',
      bodyText: 'Hi {{1}},\n\nYour payment of {{2}} could not be processed.\n\nPlease update your payment method to continue your service.',
      footerText: '',
      buttonLabels: ['Update payment'],
      variables: ['name', 'amount'],
      status: 'LIBRARY'
    },
    {
      name: 'invoice_sent',
      category: 'UTILITY',
      subcategory: 'Payments',
      language: 'en_US',
      headerText: 'New invoice',
      bodyText: 'Hi {{1}},\n\nInvoice #{{2}} for {{3}} has been generated.\n\nDue date: {{4}}\n\nPlease review and complete payment.',
      footerText: '',
      buttonLabels: ['View invoice', 'Pay now'],
      variables: ['name', 'invoice_id', 'amount', 'due_date'],
      status: 'LIBRARY'
    },
    {
      name: 'subscription_renewed',
      category: 'UTILITY',
      subcategory: 'Payments',
      language: 'en_US',
      headerText: 'Subscription renewed',
      bodyText: 'Hi {{1}},\n\nYour subscription has been renewed!\n\nAmount: {{2}}\nNext billing date: {{3}}\n\nThank you for continuing with us!',
      footerText: '',
      buttonLabels: ['Manage subscription'],
      variables: ['name', 'amount', 'next_date'],
      status: 'LIBRARY'
    },
    {
      name: 'subscription_expiring',
      category: 'UTILITY',
      subcategory: 'Payments',
      language: 'en_US',
      headerText: 'Subscription expiring soon',
      bodyText: 'Hi {{1}},\n\nYour subscription will expire on {{2}}.\n\nRenew now to keep enjoying our services without interruption.',
      footerText: '',
      buttonLabels: ['Renew now'],
      variables: ['name', 'expiry_date'],
      status: 'LIBRARY'
    },
    
    // UTILITY - Customer Feedback (10+ templates)
    {
      name: 'feedback_request',
      category: 'UTILITY',
      subcategory: 'Customer feedback',
      language: 'en_US',
      headerText: 'How was your experience?',
      bodyText: 'Hi {{1}},\n\nWe hope you enjoyed {{2}}!\n\nYour feedback helps us improve. Would you take a moment to rate your experience?',
      footerText: '',
      buttonLabels: ['Rate now', 'Maybe later'],
      variables: ['name', 'service_product'],
      status: 'LIBRARY'
    },
    {
      name: 'review_request',
      category: 'UTILITY',
      subcategory: 'Customer feedback',
      language: 'en_US',
      headerText: 'Leave a review',
      bodyText: 'Hi {{1}},\n\nThank you for your recent purchase!\n\nIf you\'re happy with {{2}}, we\'d love for you to leave a review.',
      footerText: '',
      buttonLabels: ['Write review'],
      variables: ['name', 'product_name'],
      status: 'LIBRARY'
    },
    {
      name: 'nps_survey',
      category: 'UTILITY',
      subcategory: 'Customer feedback',
      language: 'en_US',
      headerText: 'Quick question',
      bodyText: 'Hi {{1}},\n\nOn a scale of 0-10, how likely are you to recommend us to a friend?\n\nYour feedback is valuable to us!',
      footerText: '',
      buttonLabels: ['0-3 Not likely', '4-6 Maybe', '7-10 Very likely'],
      variables: ['name'],
      status: 'LIBRARY'
    },
    
    // AUTHENTICATION (18 templates)
    {
      name: 'otp_verification',
      category: 'AUTHENTICATION',
      subcategory: 'Verification',
      language: 'en_US',
      headerText: '',
      bodyText: 'Your verification code is {{1}}.\n\nThis code expires in {{2}} minutes.\n\nDon\'t share this code with anyone.',
      footerText: '',
      buttonLabels: [],
      variables: ['otp_code', 'expiry_minutes'],
      status: 'LIBRARY'
    },
    {
      name: 'otp_with_button',
      category: 'AUTHENTICATION',
      subcategory: 'Verification',
      language: 'en_US',
      headerText: '',
      bodyText: 'Your verification code is {{1}}. This code expires in {{2}} minutes.',
      footerText: '',
      buttonLabels: ['Copy code'],
      variables: ['otp_code', 'expiry_minutes'],
      status: 'LIBRARY'
    },
    {
      name: 'login_otp',
      category: 'AUTHENTICATION',
      subcategory: 'Verification',
      language: 'en_US',
      headerText: 'Login verification',
      bodyText: 'Hi {{1}},\n\nYour login verification code is: {{2}}\n\nThis code will expire in 10 minutes.',
      footerText: '',
      buttonLabels: [],
      variables: ['name', 'otp_code'],
      status: 'LIBRARY'
    },
    {
      name: 'signup_otp',
      category: 'AUTHENTICATION',
      subcategory: 'Verification',
      language: 'en_US',
      headerText: 'Complete your signup',
      bodyText: 'Welcome {{1}}!\n\nYour signup verification code is: {{2}}\n\nEnter this code to complete your registration.',
      footerText: '',
      buttonLabels: [],
      variables: ['name', 'otp_code'],
      status: 'LIBRARY'
    },
    {
      name: 'phone_verification',
      category: 'AUTHENTICATION',
      subcategory: 'Verification',
      language: 'en_US',
      headerText: 'Verify your phone',
      bodyText: 'Your phone verification code is {{1}}.\n\nEnter this code in the app to verify your phone number.',
      footerText: 'Code expires in 5 minutes',
      buttonLabels: [],
      variables: ['otp_code'],
      status: 'LIBRARY'
    },
    {
      name: 'email_verification',
      category: 'AUTHENTICATION',
      subcategory: 'Verification',
      language: 'en_US',
      headerText: 'Verify your email',
      bodyText: 'Hi {{1}},\n\nYour email verification code is: {{2}}\n\nUse this code to verify your email address.',
      footerText: '',
      buttonLabels: [],
      variables: ['name', 'otp_code'],
      status: 'LIBRARY'
    },
    {
      name: 'two_factor_auth',
      category: 'AUTHENTICATION',
      subcategory: 'Verification',
      language: 'en_US',
      headerText: '2FA Code',
      bodyText: 'Your two-factor authentication code is {{1}}.\n\nIf you didn\'t request this, please secure your account immediately.',
      footerText: '',
      buttonLabels: [],
      variables: ['otp_code'],
      status: 'LIBRARY'
    },
    {
      name: 'new_device_login',
      category: 'AUTHENTICATION',
      subcategory: 'Security',
      language: 'en_US',
      headerText: 'New login detected',
      bodyText: 'Hi {{1}},\n\nA new login to your account was detected.\n\nDevice: {{2}}\nLocation: {{3}}\nTime: {{4}}\n\nIf this wasn\'t you, please secure your account.',
      footerText: '',
      buttonLabels: ['It was me', 'Secure account'],
      variables: ['name', 'device', 'location', 'time'],
      status: 'LIBRARY'
    },
    {
      name: 'password_changed',
      category: 'AUTHENTICATION',
      subcategory: 'Security',
      language: 'en_US',
      headerText: 'Password changed',
      bodyText: 'Hi {{1}},\n\nYour password was successfully changed on {{2}}.\n\nIf you didn\'t make this change, please contact support immediately.',
      footerText: '',
      buttonLabels: ['Contact support'],
      variables: ['name', 'date'],
      status: 'LIBRARY'
    },
    {
      name: 'suspicious_activity',
      category: 'AUTHENTICATION',
      subcategory: 'Security',
      language: 'en_US',
      headerText: '⚠️ Security alert',
      bodyText: 'Hi {{1}},\n\nWe detected suspicious activity on your account.\n\nPlease verify your identity to continue using your account.',
      footerText: '',
      buttonLabels: ['Verify now'],
      variables: ['name'],
      status: 'LIBRARY'
    },
    
    // MARKETING (30+ templates)
    {
      name: 'welcome_message',
      category: 'MARKETING',
      subcategory: 'Onboarding',
      language: 'en_US',
      headerText: 'Welcome! 🎉',
      bodyText: 'Hi {{1}},\n\nWelcome to {{2}}! We\'re excited to have you.\n\nExplore our products and let us know if you need any help.',
      footerText: '',
      buttonLabels: ['Start shopping', 'Learn more'],
      variables: ['name', 'business_name'],
      status: 'LIBRARY'
    },
    {
      name: 'first_purchase_offer',
      category: 'MARKETING',
      subcategory: 'Onboarding',
      language: 'en_US',
      headerText: 'Special offer for you! 🎁',
      bodyText: 'Hi {{1}},\n\nAs a welcome gift, enjoy {{2}}% off your first purchase!\n\nUse code: {{3}}\n\nValid for 7 days.',
      footerText: '',
      buttonLabels: ['Shop now'],
      variables: ['name', 'discount', 'code'],
      status: 'LIBRARY'
    },
    {
      name: 'promotional_offer',
      category: 'MARKETING',
      subcategory: 'Promotions',
      language: 'en_US',
      headerText: 'Special offer! 🔥',
      bodyText: 'Hi {{1}},\n\nDon\'t miss out! Get {{2}}% off on {{3}}.\n\nUse code: {{4}}\nValid until: {{5}}',
      footerText: '',
      buttonLabels: ['Shop now'],
      variables: ['name', 'discount', 'products', 'code', 'expiry'],
      status: 'LIBRARY'
    },
    {
      name: 'flash_sale',
      category: 'MARKETING',
      subcategory: 'Promotions',
      language: 'en_US',
      headerText: '⚡ Flash Sale!',
      bodyText: 'Hi {{1}},\n\n24-HOUR FLASH SALE!\n\nUp to {{2}}% off on select items.\n\nHurry, sale ends at midnight!',
      footerText: '',
      buttonLabels: ['Shop the sale'],
      variables: ['name', 'discount'],
      status: 'LIBRARY'
    },
    {
      name: 'seasonal_sale',
      category: 'MARKETING',
      subcategory: 'Promotions',
      language: 'en_US',
      headerText: '🎄 Holiday Sale',
      bodyText: 'Hi {{1}},\n\nOur biggest sale of the year is here!\n\n{{2}}% off everything.\n\nCode: {{3}}\nEnds: {{4}}',
      footerText: '',
      buttonLabels: ['Shop now'],
      variables: ['name', 'discount', 'code', 'end_date'],
      status: 'LIBRARY'
    },
    {
      name: 'birthday_offer',
      category: 'MARKETING',
      subcategory: 'Promotions',
      language: 'en_US',
      headerText: '🎂 Happy Birthday!',
      bodyText: 'Hi {{1}},\n\nHappy Birthday! 🎉\n\nCelebrate with {{2}}% off your next order.\n\nUse code: {{3}}\n\nValid this month only!',
      footerText: '',
      buttonLabels: ['Claim offer'],
      variables: ['name', 'discount', 'code'],
      status: 'LIBRARY'
    },
    {
      name: 'loyalty_reward',
      category: 'MARKETING',
      subcategory: 'Promotions',
      language: 'en_US',
      headerText: '🏆 You earned a reward!',
      bodyText: 'Hi {{1}},\n\nThank you for being a loyal customer!\n\nYou\'ve earned {{2}} points.\n\nRedeem them on your next purchase!',
      footerText: '',
      buttonLabels: ['Redeem now'],
      variables: ['name', 'points'],
      status: 'LIBRARY'
    },
    {
      name: 'new_arrival',
      category: 'MARKETING',
      subcategory: 'Product updates',
      language: 'en_US',
      headerText: '✨ New arrivals!',
      bodyText: 'Hi {{1}},\n\nCheck out our latest collection: {{2}}\n\nBe the first to get your hands on these new items!',
      footerText: '',
      buttonLabels: ['See new arrivals'],
      variables: ['name', 'collection_name'],
      status: 'LIBRARY'
    },
    {
      name: 'product_launch',
      category: 'MARKETING',
      subcategory: 'Product updates',
      language: 'en_US',
      headerText: '🚀 New product launch!',
      bodyText: 'Hi {{1}},\n\nIntroducing {{2}}!\n\n{{3}}\n\nGet yours now!',
      footerText: '',
      buttonLabels: ['Learn more', 'Buy now'],
      variables: ['name', 'product_name', 'description'],
      status: 'LIBRARY'
    },
    {
      name: 'event_invitation',
      category: 'MARKETING',
      subcategory: 'Events',
      language: 'en_US',
      headerText: '🎉 You\'re invited!',
      bodyText: 'Hi {{1}},\n\nYou\'re invited to {{2}}!\n\nDate: {{3}}\nTime: {{4}}\nLocation: {{5}}\n\nDon\'t miss out!',
      footerText: '',
      buttonLabels: ['RSVP', 'Learn more'],
      variables: ['name', 'event_name', 'date', 'time', 'location'],
      status: 'LIBRARY'
    },
    {
      name: 'webinar_invitation',
      category: 'MARKETING',
      subcategory: 'Events',
      language: 'en_US',
      headerText: '📺 Free webinar',
      bodyText: 'Hi {{1}},\n\nJoin our free webinar: {{2}}\n\nDate: {{3}}\nTime: {{4}}\n\nLearn from industry experts!',
      footerText: '',
      buttonLabels: ['Register now'],
      variables: ['name', 'topic', 'date', 'time'],
      status: 'LIBRARY'
    },
    {
      name: 'newsletter',
      category: 'MARKETING',
      subcategory: 'Updates',
      language: 'en_US',
      headerText: '📧 Weekly update',
      bodyText: 'Hi {{1}},\n\nHere\'s what\'s new this week:\n\n{{2}}\n\nStay tuned for more updates!',
      footerText: '',
      buttonLabels: ['Read more'],
      variables: ['name', 'content_summary'],
      status: 'LIBRARY'
    },
    {
      name: 'win_back',
      category: 'MARKETING',
      subcategory: 'Re-engagement',
      language: 'en_US',
      headerText: 'We miss you! 💔',
      bodyText: 'Hi {{1}},\n\nIt\'s been a while since we\'ve seen you!\n\nCome back and enjoy {{2}}% off your next order.\n\nCode: {{3}}',
      footerText: '',
      buttonLabels: ['Shop now'],
      variables: ['name', 'discount', 'code'],
      status: 'LIBRARY'
    },
    {
      name: 'referral_invite',
      category: 'MARKETING',
      subcategory: 'Referral',
      language: 'en_US',
      headerText: '🎁 Share & earn',
      bodyText: 'Hi {{1}},\n\nShare the love! Refer a friend and you both get {{2}} off.\n\nYour referral code: {{3}}',
      footerText: '',
      buttonLabels: ['Share now'],
      variables: ['name', 'discount', 'referral_code'],
      status: 'LIBRARY'
    }
  ];
  
  // Filter by category
  let filtered = templates;
  if (category && category !== 'all') {
    filtered = templates.filter(t => t.category.toUpperCase() === category.toUpperCase());
  }
  
  // Count by category
  const categories = {
    UTILITY: templates.filter(t => t.category === 'UTILITY').length,
    AUTHENTICATION: templates.filter(t => t.category === 'AUTHENTICATION').length,
    MARKETING: templates.filter(t => t.category === 'MARKETING').length
  };
  
  return {
    success: true,
    templates: filtered,
    total: filtered.length,
    categories,
    source: 'BUILT_IN'
  };
}

/**
 * Alternative method to fetch Template Library using the sample_templates endpoint
 */
async function fetchTemplateLibraryAlternative(accessToken, wabaId, category = null, language = 'en_US', limit = 100) {
  // Return built-in templates as fallback
  return getBuiltInTemplateLibrary(category, language);
}

/**
 * Copy a template from Meta's Template Library to your WABA
 * This creates a new template based on a library template
 * 
 * For library templates with buttons, we need to provide button inputs.
 * If library copy fails, we fall back to creating the template directly from our built-in content.
 */
async function copyFromTemplateLibrary(accessToken, wabaId, libraryTemplateName, customName = null, language = 'en_US', category = 'UTILITY', templateData = null) {
  const url = `${META_BASE_URL}/${wabaId}/message_templates`;
  const templateName = customName || libraryTemplateName;
  
  // First, try to copy from Meta's library (for official library templates)
  try {
    const payload = {
      name: templateName,
      language: language,
      category: category,
      library_template_name: libraryTemplateName,
      library_template_button_inputs: []
    };
    
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
      data: response.data,
      source: 'META_LIBRARY'
    };
  } catch (libraryError) {
    console.log('Meta library copy failed, creating template directly:', libraryError.response?.data?.error?.message || libraryError.message);
    
    // If Meta library copy fails, create the template directly from our built-in template data
    if (templateData) {
      return createTemplateFromBuiltIn(accessToken, wabaId, templateName, language, category, templateData);
    }
    
    // If no template data provided, try to find it in our built-in library
    const builtInTemplates = getBuiltInTemplateLibrary(category, language);
    const matchingTemplate = builtInTemplates.templates.find(t => t.name === libraryTemplateName);
    
    if (matchingTemplate) {
      return createTemplateFromBuiltIn(accessToken, wabaId, templateName, language, category, matchingTemplate);
    }
    
    throw new Error(libraryError.response?.data?.error?.message || libraryError.message);
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

/**
 * Create a template directly from built-in template data
 * This is used as a fallback when Meta's library copy doesn't work
 */
async function createTemplateFromBuiltIn(accessToken, wabaId, templateName, language, category, templateData) {
  const url = `${META_BASE_URL}/${wabaId}/message_templates`;
  
  try {
    // Build the components array
    const components = [];
    
    // Extract variables from body text to create example values
    const extractVariables = (text) => {
      const regex = /\{\{(\d+)\}\}/g;
      const matches = [];
      let match;
      while ((match = regex.exec(text)) !== null) {
        if (!matches.includes(match[1])) {
          matches.push(match[1]);
        }
      }
      return matches.sort((a, b) => parseInt(a) - parseInt(b));
    };
    
    // Get variable samples from templateData or generate defaults
    const variableSamples = templateData.variableSamples || {};
    const variables = templateData.variables || [];
    
    // Add HEADER if exists (sanitize to remove emojis and special chars)
    if (templateData.headerText) {
      const sanitizedHeader = sanitizeHeaderText(templateData.headerText);
      if (sanitizedHeader) {
        const headerVars = extractVariables(sanitizedHeader);
        const headerComponent = {
          type: 'HEADER',
          format: 'TEXT',
          text: sanitizedHeader
        };
        
        // Add example values for header variables
        if (headerVars.length > 0) {
          headerComponent.example = {
            header_text: headerVars.map((v, idx) => 
              variableSamples[v] || variables[parseInt(v) - 1] || `Sample ${v}`
            )
          };
        }
        
        components.push(headerComponent);
      }
    }
    
    // Add BODY (required)
    const bodyText = templateData.bodyText || templateData.body || 'Template body';
    const bodyVars = extractVariables(bodyText);
    const bodyComponent = {
      type: 'BODY',
      text: bodyText
    };
    
    // Add example values for body variables
    if (bodyVars.length > 0) {
      bodyComponent.example = {
        body_text: [bodyVars.map((v, idx) => 
          variableSamples[v] || variables[parseInt(v) - 1] || `Sample ${v}`
        )]
      };
    }
    components.push(bodyComponent);
    
    // Add FOOTER if exists
    if (templateData.footerText) {
      components.push({
        type: 'FOOTER',
        text: templateData.footerText
      });
    }
    
    // Add BUTTONS if exist (limit to 3 buttons max for QUICK_REPLY)
    if (templateData.buttonLabels && templateData.buttonLabels.length > 0) {
      const buttonLabels = templateData.buttonLabels.slice(0, 3); // Max 3 quick reply buttons
      const buttons = buttonLabels.map(label => ({
        type: 'QUICK_REPLY',
        text: (label || '').substring(0, 25) // Max 25 chars for button text
      }));
      components.push({
        type: 'BUTTONS',
        buttons: buttons
      });
    }
    
    const payload = {
      name: templateName,
      language: language,
      category: category,
      components: components
    };
    
    console.log('Creating template directly:', JSON.stringify(payload, null, 2));
    
    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    return {
      success: true,
      templateId: response.data.id,
      status: response.data.status || 'PENDING',
      data: response.data,
      source: 'BUILT_IN'
    };
  } catch (error) {
    console.error('Error creating template from built-in:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.message || error.message);
  }
}

module.exports = {
  sendTextMessage,
  sendTemplateMessage,
  fetchTemplates,
  fetchTemplateLibrary,
  getBuiltInTemplateLibrary,
  copyFromTemplateLibrary,
  createTemplateFromBuiltIn,
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
