const axios = require('axios');
const bspConfig = require('../config/bspConfig');
const partnerTokenService = require('./partnerTokenService');

function normalizeRawToken(token) {
  return String(token || '').replace(/^Bearer\s+/i, '').trim();
}

async function resolvePartnerToken(options = {}) {
  try {
    return await partnerTokenService.getPartnerToken(options.forceRefresh);
  } catch (err) {
    // No login credentials or login failed — fall back to static env token
    const envToken = normalizeRawToken(bspConfig.gupshup.partnerToken);
    if (envToken) {
      return envToken;
    }
    throw new Error('GUPSHUP_PARTNER_TOKEN_MISSING');
  }
}

async function getPartnerHeaders(options = {}) {
  const rawToken = normalizeRawToken(await resolvePartnerToken(options));
  const authToken = `Bearer ${rawToken}`;

  return {
    Authorization: authToken,
    token: rawToken,
    Accept: 'application/json'
  };
}

function getApiHeaders(appApiKey) {
  if (!appApiKey) {
    throw new Error('GUPSHUP_API_KEY_MISSING');
  }
  return {
    apikey: appApiKey,
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json'
  };
}

function isUnauthorizedError(error) {
  return Number(error?.response?.status) === 401;
}

function isAuthRejectedError(error) {
  const status = Number(error?.response?.status);
  return status === 401 || status === 403;
}

async function withPartnerAuth(requestFn) {
  try {
    const headers = await getPartnerHeaders();
    return await requestFn(headers);
  } catch (error) {
    if (!isUnauthorizedError(error) || !hasPartnerLoginCredentials()) {
      throw error;
    }

    const refreshedHeaders = await getPartnerHeaders({ forceRefresh: true });
    return requestFn(refreshedHeaders);
  }
}

function buildMsgPayload({ source, destination, message, channel = 'whatsapp' }) {
  const form = new URLSearchParams();
  form.set('channel', channel);
  form.set('source', source);
  form.set('destination', destination);
  form.set('message', JSON.stringify(message));
  return form.toString();
}

async function sendText({ source, destination, text, appApiKey }) {
  const url = `${bspConfig.apiBaseUrl}/wa/api/v1/msg`;
  const body = buildMsgPayload({
    source,
    destination,
    message: {
      type: 'text',
      text
    }
  });

  const response = await axios.post(url, body, {
    headers: getApiHeaders(appApiKey),
    timeout: 15000
  });

  return response.data;
}

async function sendTemplate({ source, destination, templateId, languageCode = 'en', params = [], appApiKey }) {
  const url = `${bspConfig.apiBaseUrl}/wa/api/v1/msg`;
  const body = buildMsgPayload({
    source,
    destination,
    message: {
      type: 'template',
      template: {
        id: templateId,
        languageCode,
        params
      }
    }
  });

  const response = await axios.post(url, body, {
    headers: getApiHeaders(appApiKey),
    timeout: 15000
  });

  return response.data;
}

async function sendMedia({ source, destination, mediaType, mediaUrl, caption, appApiKey }) {
  const url = `${bspConfig.apiBaseUrl}/wa/api/v1/msg`;
  const message = {
    type: mediaType,
    [mediaType]: {
      link: mediaUrl
    }
  };

  if (caption && ['image', 'video', 'document'].includes(mediaType)) {
    message[mediaType].caption = caption;
  }

  const body = buildMsgPayload({ source, destination, message });

  const response = await axios.post(url, body, {
    headers: getApiHeaders(appApiKey),
    timeout: 15000
  });

  return response.data;
}

async function listTemplates({ appId, appApiKey, pageNo = 1, pageSize = 100, templateStatus, languageCode }) {
  if (!appId || !appApiKey) {
    throw new Error('GUPSHUP_CREDENTIALS_MISSING');
  }
  const url = `${bspConfig.partnerBaseUrl}/partner/app/${appId}/templates`;

  const params = { pageNo, pageSize };
  if (templateStatus) params.status = templateStatus;
  if (languageCode) params.languageCode = languageCode;

  const normalizedKey = String(appApiKey || '').trim();
  const headerVariants = [
    { Authorization: normalizedKey, token: normalizedKey, Accept: 'application/json' },
    { Authorization: `Bearer ${normalizedKey}`, token: normalizedKey, Accept: 'application/json' },
    { token: normalizedKey, Accept: 'application/json' }
  ];

  let lastError = null;
  for (const headers of headerVariants) {
    try {
      const response = await axios.get(url, {
        params,
        headers,
        timeout: 15000
      });
      return response.data;
    } catch (error) {
      lastError = error;
      if (!isAuthRejectedError(error)) {
        throw error;
      }
    }
  }

  throw lastError;
}

/**
 * Upload sample media for template creation
 */
async function uploadTemplateMediaForApp({ appId, appApiKey, fileBuffer, fileName, mimeType }) {
  if (!appId || !appApiKey) {
    throw new Error('GUPSHUP_CREDENTIALS_MISSING');
  }

  const url = `${bspConfig.partnerBaseUrl}/partner/app/${appId}/upload/media`;

  // Start with the provided API key, but we'll try a fresh token if it fails.
  let tokensToTry = [String(appApiKey || '').trim()];

  let lastError = null;
  for (const token of tokensToTry) {
    const headerVariants = [
      { Authorization: token, token: token },
      { Authorization: `Bearer ${token}`, token: token },
      { token: token }
    ];

    for (const baseHeaders of headerVariants) {
      try {
        // Use native FormData and fetch to prevent socket EPIPE crashes natively on failures
        // node-fetch / undici handle closing sockets flawlessly unlike axios 1.x with raw streams
        const formData = new FormData();
        formData.append('file_type', mimeType);
        
        // Wrap fileBuffer in native Blob object for FormData
        const blob = new Blob([fileBuffer], { type: mimeType });
        formData.append('file', blob, fileName);

        const response = await fetch(url, {
          method: 'POST',
          headers: baseHeaders, // fetch automatically calculates multipart/form-data boundary with native FormData
          body: formData
        });

        if (!response.ok) {
          let errorData = await response.text();
          try {
            errorData = JSON.parse(errorData);
          } catch (e) {
            errorData = { message: errorData };
          }
          
          const error = new Error(errorData.message || `Media upload failed with status ${response.status}`);
          error.response = { status: response.status, data: errorData };
          throw error;
        }

        const responseData = await response.json();
        return responseData; // Should return { status: 'success', message: 'handleId' }
      } catch (error) {
        lastError = error;
        if (!isAuthRejectedError(error)) {
          // If it's a non-auth error (like 400 Bad Request), stop trying variants
          break;
        }
      }
    }

    // If we've exhausted all header variants for the first token, and we haven't tried a dynamic token yet
    if (tokensToTry.length === 1 && isAuthRejectedError(lastError)) {
      try {
        // Fallback: The stored API key might be revoked, fetch a fresh dynamic app token
        const freshToken = await getPartnerAppAccessToken(appId);
        if (freshToken && freshToken !== tokensToTry[0]) {
          tokensToTry.push(freshToken);
        }
      } catch (tokenErr) {
        console.error('[GupshupService] Failed to fetch fallback fresh app token:', tokenErr.message);
      }
    }
  }

  const responseData = lastError?.response?.data;
  console.error('[GupshupService] Media upload failed:', {
    appId,
    status: lastError?.response?.status,
    data: responseData,
    message: lastError?.message,
    code: lastError?.code
  });
  throw new Error(responseData?.message || lastError?.message || 'Failed to upload template media');
}

async function createTemplateForApp({ appId, appApiKey, template }) {
  if (!appId || !appApiKey) {
    throw new Error('GUPSHUP_CREDENTIALS_MISSING');
  }

  const url = `${bspConfig.partnerBaseUrl}/partner/app/${appId}/templates`;
  const normalizedKey = String(appApiKey || '').trim();

  const parseComponentType = (component) => String(component?.type || '').toUpperCase();
  const parseHeaderFormat = (component) => String(component?.format || '').toUpperCase();

  const bodyComponent = Array.isArray(template?.components)
    ? template.components.find((component) => parseComponentType(component) === 'BODY')
    : null;
  const headerComponent = Array.isArray(template?.components)
    ? template.components.find((component) => parseComponentType(component) === 'HEADER')
    : null;
  const footerComponent = Array.isArray(template?.components)
    ? template.components.find((component) => parseComponentType(component) === 'FOOTER')
    : null;
  const buttonsComponent = Array.isArray(template?.components)
    ? template.components.find((component) => parseComponentType(component) === 'BUTTONS')
    : null;

  const headerFormat = parseHeaderFormat(headerComponent);
  const inferredTemplateType = ['IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'].includes(headerFormat)
    ? headerFormat
    : 'TEXT';

  const bodyText = String(bodyComponent?.text || template?.content || '').trim();
  const bodyExamples = bodyComponent?.example?.body_text;
  const firstBodyExampleRow = Array.isArray(bodyExamples) && Array.isArray(bodyExamples[0])
    ? bodyExamples[0]
    : [];

  const resolvedExample = bodyText.replace(/\{\{(\d+)\}\}/g, (_match, placeholderIndex) => {
    const slot = Number(placeholderIndex) - 1;
    return slot >= 0 && firstBodyExampleRow[slot] ? firstBodyExampleRow[slot] : 'Sample';
  }) || bodyText;

  const mapButtons = (buttons) => {
    if (!Array.isArray(buttons) || buttons.length === 0) return null;
    return buttons.map((button) => {
      const mapped = {
        type: button.type,
        text: button.text
      };

      if (button.url) {
        mapped.url = button.url;
      }
      if (button.phone_number) {
        mapped.phone_number = button.phone_number;
      }
      if (Array.isArray(button.example) && button.example.length > 0) {
        mapped.example = button.example;
      }
      // Flow buttons
      if (button.type === 'FLOW') {
        if (button.flow_id) mapped.flow_id = button.flow_id;
        if (button.flow_action) mapped.flow_action = button.flow_action;
        if (button.navigate_screen) mapped.navigate_screen = button.navigate_screen;
      }

      return mapped;
    });
  };

  let templateTypeFinal = String(template?.templateType || inferredTemplateType).toUpperCase();
  if (template?.components) {
    const carouselComp = template.components.find((c) => parseComponentType(c) === 'CAROUSEL');
    if (carouselComp) templateTypeFinal = 'CAROUSEL';
    if (template.templateType === 'GIF') templateTypeFinal = 'GIF';
    if (template.templateType === 'PRODUCT') templateTypeFinal = 'PRODUCT';
    if (template.templateType === 'CATALOG') templateTypeFinal = 'CATALOG';
  }

  const defaultVertical = {
    MARKETING: 'promotional offer',
    UTILITY: 'account update',
    AUTHENTICATION: 'otp verification'
  };

  const templateRequest = {
    elementName: String(template?.elementName || template?.name || '').trim(),
    languageCode: String(template?.languageCode || template?.language || 'en').trim(),
    category: String(template?.category || 'UTILITY').toUpperCase(),
    templateType: templateTypeFinal,
    vertical: String(template?.vertical || template?.templateLabel || defaultVertical[String(template?.category || 'UTILITY').toUpperCase()] || 'account update'),
    content: bodyText,
    example: String(template?.example || resolvedExample || bodyText),
    enableSample: template?.enableSample !== false,
    allowTemplateCategoryChange: template?.allowTemplateCategoryChange !== false,
    parameterFormat: template?.parameterFormat || 'POSITIONAL'
  };

  // Add media handles dynamically from Meta payload format if needed
  let exampleMedia = template?.exampleMedia;
  if (!exampleMedia && headerComponent && headerComponent.example) {
      if (Array.isArray(headerComponent.example.header_handle) && headerComponent.example.header_handle.length > 0) {
          exampleMedia = headerComponent.example.header_handle[0];
      }
  }

  if (['IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'].includes(templateTypeFinal) && exampleMedia) {
    templateRequest.exampleMedia = exampleMedia;
  }
  if (templateTypeFinal === 'GIF') {
    if (template.mediaId || exampleMedia) templateRequest.mediaId = template.mediaId || exampleMedia;
    if (template.mediaUrl) templateRequest.mediaUrl = template.mediaUrl;
  }

  // Add Cards
  const carouselComponent = Array.isArray(template?.components) ? template.components.find((c) => parseComponentType(c) === 'CAROUSEL') : null;
  if (carouselComponent && carouselComponent.cards) {
    templateRequest.cards = carouselComponent.cards;
  }

  if (headerComponent?.text) {
    templateRequest.header = headerComponent.text;
    templateRequest.exampleHeader = String(
      template?.exampleHeader || headerComponent?.example?.header_text?.[0] || headerComponent.text
    );
  }

  if (footerComponent?.text) {
    templateRequest.footer = footerComponent.text;
  }

  const mappedButtons = mapButtons(buttonsComponent?.buttons);
  if (mappedButtons) {
    templateRequest.buttons = mappedButtons;
  }

  const headerVariants = [
    {
      Authorization: normalizedKey,
      token: normalizedKey,
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    {
      Authorization: `Bearer ${normalizedKey}`,
      token: normalizedKey,
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    {
      token: normalizedKey,
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  ];

  const buildFormBody = () => {
    const form = new URLSearchParams();
    form.set('elementName', templateRequest.elementName);
    form.set('languageCode', templateRequest.languageCode);
    form.set('category', templateRequest.category);
    form.set('templateType', templateRequest.templateType);
    form.set('vertical', templateRequest.vertical);
    form.set('content', templateRequest.content);
    if (templateRequest.example) form.set('example', templateRequest.example);
    form.set('enableSample', String(templateRequest.enableSample));
    form.set('allowTemplateCategoryChange', String(templateRequest.allowTemplateCategoryChange));

    if (templateRequest.parameterFormat) form.set('parameterFormat', templateRequest.parameterFormat);
    if (templateRequest.header) form.set('header', templateRequest.header);
    if (templateRequest.exampleHeader) form.set('exampleHeader', templateRequest.exampleHeader);
    if (templateRequest.footer) form.set('footer', templateRequest.footer);
    if (templateRequest.buttons) form.set('buttons', JSON.stringify(templateRequest.buttons));
    
    if (templateRequest.exampleMedia) form.set('exampleMedia', templateRequest.exampleMedia);
    if (templateRequest.mediaId) form.set('mediaId', templateRequest.mediaId);
    if (templateRequest.mediaUrl) form.set('mediaUrl', templateRequest.mediaUrl);
    if (templateRequest.cards) form.set('cards', JSON.stringify(templateRequest.cards));

    // Handle required enableSample for Media
    if (['IMAGE', 'VIDEO', 'DOCUMENT', 'CAROUSEL', 'GIF'].includes(templateRequest.templateType)) {
      form.set('enableSample', 'true');
    }

    return form.toString();
  };

  let lastError = null;
  for (const headers of headerVariants) {
    try {
      const response = await axios.post(url, buildFormBody(), {
        headers,
        timeout: 20000
      });
      return response.data;
    } catch (error) {
      lastError = error;

      if (!isAuthRejectedError(error)) {
        throw error;
      }
    }
  }

  throw lastError;
}

async function deleteTemplateForApp({ appId, appApiKey, elementName, templateId }) {
  if (!appId || !appApiKey || !elementName) {
    throw new Error('GUPSHUP_CREDENTIALS_OR_ELEMENT_NAME_MISSING');
  }

  let url = `${bspConfig.partnerBaseUrl}/partner/app/${appId}/template/${elementName}`;
  if (templateId) {
    url += `/${templateId}`;
  }

  const normalizedKey = String(appApiKey || '').trim();

  const headerVariants = [
    {
      Authorization: normalizedKey,
      token: normalizedKey,
      Accept: 'application/json'
    },
    {
      Authorization: `Bearer ${normalizedKey}`,
      token: normalizedKey,
      Accept: 'application/json'
    },
    {
      token: normalizedKey,
      Accept: 'application/json'
    }
  ];

  let lastError = null;
  for (const headers of headerVariants) {
    try {
      const response = await axios.delete(url, {
        headers,
        timeout: 20000
      });
      return response.data;
    } catch (error) {
      lastError = error;

      if (!isAuthRejectedError(error)) {
        throw error;
      }
    }
  }

  throw lastError;
}

async function updateTemplateForApp({ appId, appApiKey, templateId, template }) {
  if (!appId || !appApiKey || !templateId) {
    throw new Error('GUPSHUP_CREDENTIALS_OR_TEMPLATE_ID_MISSING');
  }

  const url = `${bspConfig.partnerBaseUrl}/partner/app/${appId}/templates/${templateId}`;
  const normalizedKey = String(appApiKey || '').trim();

  const parseComponentType = (component) => String(component?.type || '').toUpperCase();
  const parseHeaderFormat = (component) => String(component?.format || '').toUpperCase();

  const bodyComponent = Array.isArray(template?.components)
    ? template.components.find((component) => parseComponentType(component) === 'BODY')
    : null;
  const headerComponent = Array.isArray(template?.components)
    ? template.components.find((component) => parseComponentType(component) === 'HEADER')
    : null;
  const footerComponent = Array.isArray(template?.components)
    ? template.components.find((component) => parseComponentType(component) === 'FOOTER')
    : null;
  const buttonsComponent = Array.isArray(template?.components)
    ? template.components.find((component) => parseComponentType(component) === 'BUTTONS')
    : null;

  const headerFormat = parseHeaderFormat(headerComponent);
  const inferredTemplateType = ['IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'].includes(headerFormat)
    ? headerFormat
    : 'TEXT';

  const bodyText = String(bodyComponent?.text || template?.content || '').trim();
  const bodyExamples = bodyComponent?.example?.body_text;
  const firstBodyExampleRow = Array.isArray(bodyExamples) && Array.isArray(bodyExamples[0])
    ? bodyExamples[0]
    : [];

  const resolvedExample = bodyText.replace(/\{\{(\d+)\}\}/g, (_match, placeholderIndex) => {
    const slot = Number(placeholderIndex) - 1;
    return slot >= 0 && firstBodyExampleRow[slot] ? firstBodyExampleRow[slot] : 'Sample';
  }) || bodyText;

  const mapButtons = (buttons) => {
    if (!Array.isArray(buttons) || buttons.length === 0) return null;
    return buttons.map((button) => {
      const mapped = {
        type: button.type,
        text: button.text
      };

      if (button.url) {
        mapped.url = button.url;
      }
      if (button.phone_number) {
        mapped.phone_number = button.phone_number;
      }
      if (Array.isArray(button.example) && button.example.length > 0) {
        mapped.example = button.example;
      }
      // Flow buttons
      if (button.type === 'FLOW') {
        if (button.flow_id) mapped.flow_id = button.flow_id;
        if (button.flow_action) mapped.flow_action = button.flow_action;
        if (button.navigate_screen) mapped.navigate_screen = button.navigate_screen;
      }

      return mapped;
    });
  };

  let templateTypeFinal = String(template?.templateType || inferredTemplateType).toUpperCase();
  if (template?.components) {
    const carouselComp = template.components.find((c) => parseComponentType(c) === 'CAROUSEL');
    if (carouselComp) templateTypeFinal = 'CAROUSEL';
    if (template.templateType === 'GIF') templateTypeFinal = 'GIF';
    if (template.templateType === 'PRODUCT') templateTypeFinal = 'PRODUCT';
    if (template.templateType === 'CATALOG') templateTypeFinal = 'CATALOG';
  }

  const templateRequest = {
    category: String(template?.category || 'UTILITY').toUpperCase(),
    templateType: templateTypeFinal,
    vertical: String(template?.vertical || 'Internal_vertical'),
    content: bodyText,
    example: String(template?.example || resolvedExample || bodyText),
    enableSample: template?.enableSample !== false,
    allowTemplateCategoryChange: Boolean(template?.allowTemplateCategoryChange),
    parameterFormat: template?.parameterFormat || 'POSITIONAL'
  };

  let exampleMedia = template?.exampleMedia;
  if (!exampleMedia && headerComponent && headerComponent.example) {
      if (Array.isArray(headerComponent.example.header_handle) && headerComponent.example.header_handle.length > 0) {
          exampleMedia = headerComponent.example.header_handle[0];
      }
  }

  if (['IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'].includes(templateTypeFinal) && exampleMedia) {
    templateRequest.exampleMedia = exampleMedia;
  }
  if (templateTypeFinal === 'GIF') {
    if (template.mediaId || exampleMedia) templateRequest.mediaId = template.mediaId || exampleMedia;
    if (template.mediaUrl) templateRequest.mediaUrl = template.mediaUrl;
  }

  const carouselComponent = Array.isArray(template?.components) ? template.components.find((c) => parseComponentType(c) === 'CAROUSEL') : null;
  if (carouselComponent && carouselComponent.cards) {
    templateRequest.cards = carouselComponent.cards;
  }

  if (headerComponent?.text) {
    templateRequest.header = headerComponent.text;
    templateRequest.exampleHeader = String(
      template?.exampleHeader || headerComponent?.example?.header_text?.[0] || headerComponent.text
    );
  }

  if (footerComponent?.text) {
    templateRequest.footer = footerComponent.text;
  }

  const mappedButtons = mapButtons(buttonsComponent?.buttons);
  if (mappedButtons) {
    templateRequest.buttons = mappedButtons;
  }

  const headerVariants = [
    {
      Authorization: normalizedKey,
      token: normalizedKey,
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    {
      Authorization: `Bearer ${normalizedKey}`,
      token: normalizedKey,
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    {
      token: normalizedKey,
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  ];

  const buildFormBody = () => {
    const form = new URLSearchParams();
    form.set('category', templateRequest.category);
    form.set('templateType', templateRequest.templateType);
    form.set('vertical', templateRequest.vertical);
    form.set('content', templateRequest.content);
    if (templateRequest.example) form.set('example', templateRequest.example);
    
    // Handle required enableSample for Media
    if (['IMAGE', 'VIDEO', 'DOCUMENT', 'CAROUSEL', 'GIF'].includes(templateRequest.templateType)) {
      form.set('enableSample', 'true');
    } else {
      form.set('enableSample', String(templateRequest.enableSample));
    }
    
    form.set('allowTemplateCategoryChange', String(templateRequest.allowTemplateCategoryChange));

    if (templateRequest.parameterFormat) form.set('parameterFormat', templateRequest.parameterFormat);
    if (templateRequest.header) form.set('header', templateRequest.header);
    if (templateRequest.exampleHeader) form.set('exampleHeader', templateRequest.exampleHeader);
    if (templateRequest.footer) form.set('footer', templateRequest.footer);
    if (templateRequest.buttons) form.set('buttons', JSON.stringify(templateRequest.buttons));
    
    if (templateRequest.exampleMedia) form.set('exampleMedia', templateRequest.exampleMedia);
    if (templateRequest.mediaId) form.set('mediaId', templateRequest.mediaId);
    if (templateRequest.mediaUrl) form.set('mediaUrl', templateRequest.mediaUrl);
    if (templateRequest.cards) form.set('cards', JSON.stringify(templateRequest.cards));

    return form.toString();
  };

  let lastError = null;
  for (const headers of headerVariants) {
    try {
      const response = await axios.put(url, buildFormBody(), {
        headers,
        timeout: 20000
      });
      return response.data;
    } catch (error) {
      lastError = error;

      if (!isAuthRejectedError(error)) {
        throw error;
      }
    }
  }

  throw lastError;
}

async function getPartnerApps() {
  const url = `${bspConfig.partnerBaseUrl}/partner/account/api/partnerApps`;
  return withPartnerAuth(async (headers) => {
    const response = await axios.get(url, {
      headers,
      timeout: 15000
    });

    return response.data;
  });
}

async function createPartnerApp(appName) {
  const url = `${bspConfig.partnerBaseUrl}/partner/app`;

  const body = new URLSearchParams();
  body.set('name', appName);

  return withPartnerAuth(async (headers) => {
    const response = await axios.post(url, body.toString(), {
      headers: {
        ...headers,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 15000
    });

    return response.data;
  });
}

async function updateOnboardingContact({ appId, contactName, contactEmail, contactNumber }) {
  const url = `${bspConfig.partnerBaseUrl}/partner/app/${appId}/onboarding/contact`;

  const body = new URLSearchParams();
  if (contactName) body.set('contactName', contactName);
  if (contactEmail) body.set('contactEmail', contactEmail);
  if (contactNumber) body.set('contactNumber', contactNumber);

  return withPartnerAuth(async (headers) => {
    const response = await axios.put(url, body.toString(), {
      headers: {
        ...headers,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 15000
    });

    return response.data;
  });
}

async function getOnboardingEmbedLink({ appId, regenerate = false, user, lang }) {
  const url = `${bspConfig.partnerBaseUrl}/partner/app/${appId}/onboarding/embed/link`;
  const params = {};
  if (regenerate) params.regenerate = true;
  if (user) params.user = user;
  if (lang) params.lang = lang;

  try {
    return await withPartnerAuth(async (headers) => {
      const response = await axios.get(url, {
        params,
        headers,
        timeout: 15000
      });
      return response.data;
    });
  } catch (error) {
    console.error('[GupshupService] getOnboardingEmbedLink error:', error.response?.data || error.message);
    throw error;
  }
}

function extractTokenFromResponse(data) {
  const candidates = [
    data?.token,
    data?.accessToken,
    data?.access_token,
    data?.data?.token,
    data?.data?.accessToken,
    data?.data?.access_token,
    data?.result?.token,
    data?.result?.accessToken,
    data?.result?.access_token
  ];

  const pickStringToken = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return normalizeRawToken(value);
    if (typeof value === 'object') {
      return (
        normalizeRawToken(value.token) ||
        normalizeRawToken(value.accessToken) ||
        normalizeRawToken(value.access_token) ||
        normalizeRawToken(value.value) ||
        ''
      );
    }
    return '';
  };

  for (const candidate of candidates) {
    const token = pickStringToken(candidate);
    if (token && token !== '[object Object]') {
      return token;
    }
  }

  return '';
}

/**
 * Trigger Gupshup-side template sync for an app.
 * GET /partner/app/{appId}/template/sync
 * Returns 202 Accepted. Rate limited to 1 request/hour.
 */
async function syncTemplatesForApp({ appId, appApiKey }) {
  if (!appId) {
    throw new Error('GUPSHUP_APP_ID_REQUIRED');
  }

  const url = `${bspConfig.partnerBaseUrl}/partner/app/${appId}/template/sync`;
  const normalizedKey = String(appApiKey || '').trim();

  const headerVariants = normalizedKey
    ? [
        { Authorization: normalizedKey, Accept: 'application/json' },
        { Authorization: `Bearer ${normalizedKey}`, Accept: 'application/json' },
        { token: normalizedKey, Accept: 'application/json' }
      ]
    : [];

  // Try with app access token variants first
  let lastError = null;
  for (const headers of headerVariants) {
    try {
      const response = await axios.get(url, { headers, timeout: 15000 });
      return response.data;
    } catch (error) {
      lastError = error;
      if (!isAuthRejectedError(error)) {
        throw error;
      }
    }
  }

  // Fallback to partner token auth
  try {
    return await withPartnerAuth(async (headers) => {
      const response = await axios.get(url, { headers, timeout: 15000 });
      return response.data;
    });
  } catch (error) {
    throw lastError || error;
  }
}

const { generateAppAccessToken } = require('./appTokenService');

async function getPartnerAppAccessToken(appId) {
  return await generateAppAccessToken(appId);
}

async function getPartnerAppAccessTokenOld(appId) {
  if (!appId) {
    throw new Error('GUPSHUP_APP_ID_REQUIRED');
  }

  const url = `${bspConfig.partnerBaseUrl}/partner/app/${appId}/token`;

  // resolvePartnerToken() now auto-refreshes via login if credentials exist,
  // so we always get a fresh token here.
  const partnerToken = normalizeRawToken(await resolvePartnerToken());
  if (!partnerToken) {
    throw new Error('GUPSHUP_PARTNER_TOKEN_MISSING');
  }

  console.log('[gupshup] Fetching app access token for appId:', appId);

  // Gupshup docs show: Authorization: {{PARTNER_TOKEN}} (no Bearer prefix)
  // Try multiple header formats for compatibility.
  const headerVariants = [
    { Authorization: partnerToken, token: partnerToken, Accept: 'application/json' },
    { Authorization: `Bearer ${partnerToken}`, token: partnerToken, Accept: 'application/json' },
    { token: partnerToken, Accept: 'application/json' }
  ];

  let lastError = null;
  for (const headers of headerVariants) {
    try {
      const response = await axios.get(url, { headers, timeout: 15000 });
      const token = extractTokenFromResponse(response.data);
      if (token) {
        console.log('[gupshup] Got app access token:', token.substring(0, 8) + '...');
        return token;
      }
    } catch (error) {
      lastError = error;
      if (!isAuthRejectedError(error)) throw error;
    }
  }

  throw lastError || new Error('GUPSHUP_APP_ACCESS_TOKEN_FETCH_FAILED');
}

async function resolveAppScopedToken(appId) {
  try {
    const token = await getPartnerAppAccessToken(appId);
    if (token) {
      console.log('[gupshup] Resolved app access token for', appId, '→', String(token).substring(0, 8) + '...');
      return String(token).trim();
    }
  } catch (err) {
    console.error('[gupshup] Failed to resolve app access token for', appId, ':', err.message);
    if (err?.response?.data) {
      console.error('[gupshup] Provider response:', JSON.stringify(err.response.data));
    }
  }

  throw new Error('GUPSHUP_APP_TOKEN_RESOLUTION_FAILED');
}

async function getTemplatesFromLibrary({
  appId,
  appApiKey,
  elementName,
  industry,
  languageCode,
  topic,
  usecase
}) {
  if (!appId) {
    throw new Error('GUPSHUP_APP_ID_REQUIRED');
  }

  const url = `${bspConfig.partnerBaseUrl}/partner/app/${appId}/template/metalibrary`;
  const params = {};

  if (elementName) params.elementName = elementName;
  if (industry) params.industry = industry;
  if (languageCode) params.languageCode = languageCode;
  if (topic) params.topic = topic;
  if (usecase) params.usecase = usecase;

  // Per Gupshup docs the metalibrary endpoint requires the **App Access Token**
  // (sk_…), NOT the raw partner JWT. Obtain it first.
  const appToken = await resolveAppScopedToken(appId);

  // Docs show: Authorization: {{PARTNER_APP_TOKEN}}  (no Bearer prefix)
  const headerVariants = [
    { Authorization: appToken, token: appToken, Accept: 'application/json' },
    { Authorization: `Bearer ${appToken}`, token: appToken, Accept: 'application/json' },
    { token: appToken, Accept: 'application/json' }
  ];

  let lastError = null;
  for (const headers of headerVariants) {
    try {
      const response = await axios.get(url, {
        params,
        headers,
        timeout: 15000
      });
      return response.data;
    } catch (error) {
      lastError = error;
      if (!isAuthRejectedError(error)) {
        throw error;
      }
    }
  }

  throw lastError || new Error('GUPSHUP_LIBRARY_AUTH_FAILED');
}

/**
 * Create a template from Meta's pre-approved library.
 * POST /partner/app/{appId}/template/metalibrary
 * Form-encoded: elementName, category, languageCode, libraryTemplateName, buttons
 */
async function createTemplateFromLibrary({
  appId,
  appApiKey,
  elementName,
  category,
  languageCode,
  libraryTemplateName,
  buttons,
  libraryTemplateBodyInputs
}) {
  if (!appId) {
    throw new Error('GUPSHUP_APP_ID_REQUIRED');
  }
  if (!elementName || !languageCode || !libraryTemplateName) {
    throw new Error('MISSING_REQUIRED_LIBRARY_TEMPLATE_FIELDS');
  }

  const url = `${bspConfig.partnerBaseUrl}/partner/app/${appId}/template/metalibrary`;

  const form = new URLSearchParams();
  form.set('elementName', elementName);
  form.set('category', category || 'UTILITY');
  form.set('languageCode', languageCode);
  form.set('libraryTemplateName', libraryTemplateName);
  if (buttons) {
    form.set('buttons', typeof buttons === 'string' ? buttons : JSON.stringify(buttons));
  }
  if (libraryTemplateBodyInputs) {
    form.set('libraryTemplateBodyInputs',
      typeof libraryTemplateBodyInputs === 'string'
        ? libraryTemplateBodyInputs
        : JSON.stringify(libraryTemplateBodyInputs)
    );
  }

  // Per Gupshup docs the metalibrary endpoint requires the **App Access Token**
  // (sk_…), NOT the raw partner JWT. Obtain it first.
  const appToken = await resolveAppScopedToken(appId);

  const headerVariants = [
    {
      Authorization: appToken,
      token: appToken,
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    {
      Authorization: `Bearer ${appToken}`,
      token: appToken,
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    {
      token: appToken,
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  ];

  let lastError = null;
  for (const headers of headerVariants) {
    try {
      const response = await axios.post(url, form.toString(), {
        headers,
        timeout: 15000
      });
      return response.data;
    } catch (error) {
      lastError = error;
      if (!isAuthRejectedError(error)) {
        throw error;
      }
    }
  }

  throw lastError || new Error('GUPSHUP_LIBRARY_AUTH_FAILED');
}

async function postRegisterPhone(url, body, authorizationValue) {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/x-www-form-urlencoded',
    Authorization: authorizationValue,
    token: normalizeRawToken(authorizationValue)
  };

  const response = await axios.post(url, body.toString(), {
    headers,
    timeout: 15000
  });

  return response.data;
}

async function registerPhoneForApp({ appId, region = 'IN' }) {
  if (!appId) {
    throw new Error('GUPSHUP_APP_ID_REQUIRED');
  }

  const url = `${bspConfig.partnerBaseUrl}/partner/app/${appId}/onboarding/register`;
  const body = new URLSearchParams();

  if (region) {
    body.set('region', String(region).toUpperCase());
  }

  let lastError;

  try {
    const appAccessToken = await getPartnerAppAccessToken(appId);

    try {
      return await postRegisterPhone(url, body, appAccessToken);
    } catch (errorRaw) {
      lastError = errorRaw;
      if (!isUnauthorizedError(errorRaw)) {
        throw errorRaw;
      }

      return await postRegisterPhone(url, body, `Bearer ${appAccessToken}`);
    }
  } catch (appTokenError) {
    lastError = appTokenError;
  }

  try {
    const partnerToken = normalizeRawToken(await resolvePartnerToken());
    try {
      return await postRegisterPhone(url, body, partnerToken);
    } catch (errorRaw) {
      lastError = errorRaw;
      if (!isUnauthorizedError(errorRaw)) {
        throw errorRaw;
      }

      return await postRegisterPhone(url, body, `Bearer ${partnerToken}`);
    }
  } catch (fallbackError) {
    throw fallbackError || lastError;
  }
}

async function submitBusinessInfo(_accessToken, businessAccountId, businessData = {}) {
  return {
    success: true,
    verificationId: businessAccountId || null,
    status: 'pending',
    data: {
      provider: 'gupshup',
      businessAccountId,
      ...businessData
    }
  };
}

async function submitBusinessVerification(_accessToken, businessAccountId, verificationData = {}) {
  return {
    success: true,
    verificationId: businessAccountId || null,
    status: 'pending',
    data: {
      provider: 'gupshup',
      businessAccountId,
      ...verificationData
    }
  };
}

async function getBusinessVerificationStatus(_accessToken, businessAccountId) {
  return {
    success: true,
    status: 'pending',
    isVerified: false,
    data: {
      provider: 'gupshup',
      businessAccountId
    }
  };
}

async function exchangeToken(accessToken) {
  return {
    success: true,
    accessToken,
    tokenType: 'Bearer',
    expiresIn: null
  };
}

async function debugTokenInfo(_accessToken) {
  const partnerApps = await getPartnerApps();
  const apps = partnerApps?.partnerAppsList || partnerApps?.data || [];

  return {
    tokenValid: true,
    appInfo: {
      appId: bspConfig.gupshup.appId || apps[0]?.id || null,
      type: 'partner'
    },
    businessAccounts: [],
    wabaAccounts: apps.map((app) => ({
      id: app.id,
      name: app.name
    })),
    phoneNumbers: apps
      .filter((app) => !!app.phone)
      .map((app) => ({
        id: app.phone,
        displayNumber: app.phone,
        verifiedName: app.name
      })),
    errors: []
  };
}

async function getWABAPhoneNumbers(_accessToken, wabaId) {
  const partnerApps = await getPartnerApps();
  const apps = partnerApps?.partnerAppsList || partnerApps?.data || [];
  const selected = apps.find((app) => app.id === wabaId) || apps[0] || null;

  if (!selected?.phone) {
    return {
      success: true,
      phoneNumbers: [],
      count: 0
    };
  }

  return {
    success: true,
    phoneNumbers: [
      {
        id: selected.phone,
        displayPhoneNumber: selected.phone,
        verifiedName: selected.name,
        qualityRating: 'UNKNOWN',
        status: selected.live ? 'CONNECTED' : 'PENDING',
        nameStatus: null,
        codeVerificationStatus: null
      }
    ],
    count: 1
  };
}

async function getPhoneNumberInfo(_accessToken, phoneNumberId) {
  return {
    success: true,
    id: phoneNumberId,
    displayNumber: phoneNumberId,
    verifiedName: null,
    qualityRating: 'UNKNOWN',
    status: 'CONNECTED',
    nameStatus: null,
    codeVerificationStatus: null,
    isOfficialBusinessAccount: false
  };
}

async function getWABAFromPhoneNumber(_accessToken, phoneNumberId) {
  const partnerApps = await getPartnerApps();
  const apps = partnerApps?.partnerAppsList || partnerApps?.data || [];
  const selected = apps.find((app) => app.phone === phoneNumberId) || apps[0] || null;

  return {
    phoneNumber: {
      id: phoneNumberId,
      display_phone_number: phoneNumberId,
      verified_name: selected?.name || null
    },
    wabaId: selected?.id || null
  };
}

async function lookupContactProfile(_accessToken, _wabaPhoneNumberId, phone) {
  return {
    success: true,
    contact: {
      input: phone,
      wa_id: phone,
      status: 'valid'
    },
    raw: {
      provider: 'gupshup',
      phone
    }
  };
}

module.exports = {
  sendText,
  createPartnerApp,
  sendTemplate,
  sendMedia,
  listTemplates,
  uploadTemplateMediaForApp,
  createTemplateForApp,
  deleteTemplateForApp,
  updateTemplateForApp,
  syncTemplatesForApp,
  getTemplatesFromLibrary,
  createTemplateFromLibrary,
  getPartnerApps,
  updateOnboardingContact,
  getOnboardingEmbedLink,
  getPartnerAppAccessToken,
  registerPhoneForApp,
  submitBusinessInfo,
  submitBusinessVerification,
  getBusinessVerificationStatus,
  exchangeToken,
  debugTokenInfo,
  getWABAPhoneNumbers,
  getPhoneNumberInfo,
  getWABAFromPhoneNumber,
  lookupContactProfile
};
