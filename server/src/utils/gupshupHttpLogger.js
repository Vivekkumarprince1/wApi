const axios = require('axios');
const bspConfig = require('../config/bspConfig');

function isGupshupUrl(url = '') {
  const normalizedUrl = String(url || '').toLowerCase();
  const partnerBaseUrl = String(bspConfig.partnerBaseUrl || '').toLowerCase();
  const gupshupBaseUrl = String(bspConfig.gupshup?.baseUrl || '').toLowerCase();

  return normalizedUrl.includes('gupshup')
    || (partnerBaseUrl && normalizedUrl.startsWith(partnerBaseUrl))
    || (gupshupBaseUrl && normalizedUrl.startsWith(gupshupBaseUrl));
}

function summarizeBody(body) {
  if (body === undefined || body === null) return body;
  if (typeof body === 'string') return body;

  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    const entries = [];
    for (const [key, value] of body.entries()) {
      if (typeof Blob !== 'undefined' && value instanceof Blob) {
        entries.push({ key, blob: { type: value.type, size: value.size } });
      } else {
        entries.push({ key, value });
      }
    }
    return { formData: entries };
  }

  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) {
    return body.toString();
  }

  return body;
}

function installGupshupHttpLogging() {
  if (!axios.__gupshupGlobalLoggingInterceptorInstalled) {
    axios.interceptors.request.use(
      (config) => {
        if (isGupshupUrl(config?.url)) {
          config.metadata = { ...(config.metadata || {}), startAt: Date.now() };
          console.log('[GupshupHTTP][REQUEST]', {
            method: String(config?.method || 'GET').toUpperCase(),
            url: config?.url,
            params: config?.params,
            data: summarizeBody(config?.data),
            headers: config?.headers,
            timeout: config?.timeout,
            timestamp: new Date().toISOString()
          });
        }
        return config;
      },
      (error) => {
        if (isGupshupUrl(error?.config?.url)) {
          console.log('[GupshupHTTP][REQUEST_ERROR]', {
            method: String(error?.config?.method || 'GET').toUpperCase(),
            url: error?.config?.url,
            message: error?.message,
            code: error?.code,
            stack: error?.stack,
            timestamp: new Date().toISOString()
          });
        }
        return Promise.reject(error);
      }
    );

    axios.interceptors.response.use(
      (response) => {
        if (isGupshupUrl(response?.config?.url)) {
          const startAt = response?.config?.metadata?.startAt;
          const durationMs = startAt ? Date.now() - startAt : undefined;
          console.log('[GupshupHTTP][RESPONSE]', {
            method: String(response?.config?.method || 'GET').toUpperCase(),
            url: response?.config?.url,
            status: response?.status,
            statusText: response?.statusText,
            data: response?.data,
            headers: response?.headers,
            durationMs,
            timestamp: new Date().toISOString()
          });
        }
        return response;
      },
      (error) => {
        if (isGupshupUrl(error?.config?.url)) {
          const startAt = error?.config?.metadata?.startAt;
          const durationMs = startAt ? Date.now() - startAt : undefined;
          console.log('[GupshupHTTP][RESPONSE_ERROR]', {
            method: String(error?.config?.method || 'GET').toUpperCase(),
            url: error?.config?.url,
            message: error?.message,
            code: error?.code,
            status: error?.response?.status,
            statusText: error?.response?.statusText,
            responseData: error?.response?.data,
            responseHeaders: error?.response?.headers,
            requestData: summarizeBody(error?.config?.data),
            requestParams: error?.config?.params,
            requestHeaders: error?.config?.headers,
            durationMs,
            timestamp: new Date().toISOString()
          });
        }
        return Promise.reject(error);
      }
    );

    axios.__gupshupGlobalLoggingInterceptorInstalled = true;
  }

  if (!global.__gupshupFetchLoggerInstalled && typeof fetch === 'function') {
    const originalFetch = global.fetch.bind(global);

    global.fetch = async (input, init = {}) => {
      const method = String(init?.method || 'GET').toUpperCase();
      const url = typeof input === 'string' ? input : input?.url;
      const headers = init?.headers;
      const body = summarizeBody(init?.body);

      if (!isGupshupUrl(url)) {
        return originalFetch(input, init);
      }

      const startAt = Date.now();
      console.log('[GupshupHTTP][REQUEST]', {
        method,
        url,
        headers,
        data: body,
        timestamp: new Date().toISOString()
      });

      try {
        const response = await originalFetch(input, init);
        const cloned = response.clone();
        let responseBody;
        try {
          const text = await cloned.text();
          try {
            responseBody = JSON.parse(text);
          } catch (_jsonErr) {
            responseBody = text;
          }
        } catch (_readErr) {
          responseBody = null;
        }

        console.log('[GupshupHTTP][RESPONSE]', {
          method,
          url,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          data: responseBody,
          durationMs: Date.now() - startAt,
          timestamp: new Date().toISOString()
        });

        return response;
      } catch (error) {
        console.log('[GupshupHTTP][RESPONSE_ERROR]', {
          method,
          url,
          message: error?.message,
          code: error?.code,
          requestHeaders: headers,
          requestData: body,
          durationMs: Date.now() - startAt,
          timestamp: new Date().toISOString()
        });
        throw error;
      }
    };

    global.__gupshupFetchLoggerInstalled = true;
  }
}

module.exports = {
  installGupshupHttpLogging,
  isGupshupUrl
};
