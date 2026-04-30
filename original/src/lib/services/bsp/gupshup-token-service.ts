import axios from 'axios';
import { config } from '@/lib/config';
import { connectRedis, deleteKey, getJson, setJson } from '@/lib/redis';
import { GupshupApp, Workspace } from '@/lib/models';
import { decryptSecretCBC, encryptSecretCBC } from '@/lib/services/security/secret-box';

type PartnerTokenCache = {
  token: string;
  expiresAt: string;
  refreshedAt: string;
};

type AppTokenCache = {
  appId: string;
  token: string;
  expiresAt: string;
  refreshedAt: string;
};

const PARTNER_TOKEN_CACHE_KEY = 'cache:gupshup:partner-token';
const PARTNER_TOKEN_LOCK_KEY = 'lock:gupshup:partner-token';
const APP_TOKEN_CACHE_PREFIX = 'cache:gupshup:app-token:';
const APP_TOKEN_LOCK_PREFIX = 'lock:gupshup:app-token:';
const DEFAULT_PARTNER_TOKEN_TTL_SECONDS = 23 * 60 * 60;
const DEFAULT_APP_TOKEN_TTL_SECONDS = 23 * 60 * 60;
const REFRESH_SKEW_MS = 15 * 60 * 1000;
const LOCK_TTL_SECONDS = 60;
const MEMORY_CACHE_TTL_MS = 30 * 1000; // 30 seconds local memory safety

// IN-MEMORY CACHE (Per-Process)
let partnerMemoryCache: { token: string; expiresAt: number } | null = null;
const appMemoryCache: Map<string, { token: string; expiresAt: number }> = new Map();

function normalizeToken(token?: string) {
  return String(token || '').replace(/^Bearer\s+/i, '').trim();
}

function partnerBaseUrl() {
  return config.gupshupPartnerBaseUrl.replace(/\/$/, '');
}

function isExpiringSoon(expiresAt?: string | Date | null) {
  if (!expiresAt) return true;
  const expiryTime = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiryTime)) return true;
  return expiryTime <= Date.now() + REFRESH_SKEW_MS;
}

async function readJson<T>(key: string): Promise<T | null> {
  const redis = await connectRedis();
  if (!redis) return null;
  return getJson<T>(key);
}

async function writeJson(key: string, value: unknown, ttlSeconds?: number) {
  const redis = await connectRedis();
  if (!redis) return;
  await setJson(key, value, ttlSeconds);
}

async function deleteCacheKey(key: string) {
  const redis = await connectRedis();
  if (!redis) return;
  await deleteKey(key);
}

async function acquireLock(key: string) {
  const redis = await connectRedis();
  if (!redis) return false;
  const lockValue = `${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const acquired = await redis.set(key, lockValue, 'EX', LOCK_TTL_SECONDS, 'NX');
  return acquired === 'OK';
}

async function releaseLock(key: string) {
  const redis = await connectRedis();
  if (!redis) return;
  await redis.del(key);
}

async function loginPartnerToken(): Promise<PartnerTokenCache> {
  const body = new URLSearchParams();
  const secret = config.gupshupPartnerClientSecret || config.gupshupPartnerPassword;
  
  body.append('email', config.gupshupPartnerEmail);
  body.append('password', secret); // Documentation specifies password field for the secret
  body.append('clientSecret', secret); 

  const url = `${partnerBaseUrl()}/partner/account/login`;
  console.log(`[GupshupTokenService] Attempting Partner login for ${config.gupshupPartnerEmail}...`);
  
  const response = await axios.post(url, body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10000
  });

  const token = normalizeToken(response.data?.token || response.data?.accessToken || response.data?.jwt);
  if (!token) throw new Error('Gupshup partner login did not return a token');

  const expiresAt = new Date(Date.now() + DEFAULT_PARTNER_TOKEN_TTL_SECONDS * 1000).toISOString();
  return {
    token,
    expiresAt,
    refreshedAt: new Date().toISOString()
  };
}

async function fetchAppToken(appId: string, partnerToken: string): Promise<AppTokenCache> {
  const url = `${partnerBaseUrl()}/partner/app/${appId}/token`;
  const normalized = normalizeToken(partnerToken);

  const headerVariants = [
    { Authorization: normalized, token: normalized, Accept: 'application/json' },
    { Authorization: `Bearer ${normalized}`, token: normalized, Accept: 'application/json' },
    { token: normalized, Accept: 'application/json' }
  ];

  let lastError = null;
  let responseData: any = null;

  for (const headers of headerVariants) {
    try {
      const response = await axios.get(url, { headers, timeout: 15000 });
      responseData = response.data;
      break;
    } catch (error: any) {
      lastError = error;
      const status = error.response?.status;
      if (status !== 401 && status !== 403) throw error;
    }
  }

  if (!responseData) throw lastError;

  const tokenCandidate =
    responseData?.token?.token ??
    responseData?.data?.token?.token ??
    responseData?.result?.token?.token ??
    responseData?.token ??
    responseData?.accessToken ??
    responseData?.data?.token ??
    responseData?.result?.token;

  const token = normalizeToken(typeof tokenCandidate === 'string' ? tokenCandidate : '');
  if (!token) throw new Error(`[GupshupTokenService] No token found in response for appId ${appId}`);

  const expiresAtValue = responseData?.expiresAt || responseData?.expiry || responseData?.data?.expiresAt || responseData?.result?.expiresAt;
  const expiresAt = expiresAtValue ? new Date(expiresAtValue).toISOString() : new Date(Date.now() + DEFAULT_APP_TOKEN_TTL_SECONDS * 1000).toISOString();

  return {
    appId,
    token,
    expiresAt,
    refreshedAt: new Date().toISOString()
  };
}

async function persistAppToken(appId: string, tokenRecord: AppTokenCache) {
  const encryptedApiKey = encryptSecretCBC(tokenRecord.token) || undefined;
  const expiresAt = new Date(tokenRecord.expiresAt);
  const refreshedAt = new Date(tokenRecord.refreshedAt);

  await GupshupApp.findOneAndUpdate(
    { gupshupAppId: appId },
    {
      $set: {
        encryptedApiKey,
        appApiKeyExpiresAt: expiresAt,
        appApiKeyRefreshedAt: refreshedAt,
        lastSyncedAt: refreshedAt
      }
    },
    { returnDocument: 'after' }
  );

  await Workspace.findOneAndUpdate(
    {
      $or: [{ gupshupAppId: appId }, { 'gupshupIdentity.partnerAppId': appId }]
    },
    {
      $set: {
        'gupshupIdentity.appApiKey': encryptedApiKey,
        'gupshupIdentity.appApiKeyExpiresAt': expiresAt,
        'gupshupIdentity.appApiKeyRefreshedAt': refreshedAt,
        tokenExpiresAt: expiresAt
      }
    }
  );

  await writeJson(
    `${APP_TOKEN_CACHE_PREFIX}${appId}`,
    tokenRecord,
    Math.max(60, Math.floor((expiresAt.getTime() - Date.now()) / 1000))
  );
}

async function readPersistedAppToken(appId: string): Promise<string | null> {
  // 1. Check Redis Cache
  const cached = await readJson<AppTokenCache>(`${APP_TOKEN_CACHE_PREFIX}${appId}`);
  if (cached?.token && !isExpiringSoon(cached.expiresAt)) {
    return cached.token;
  }

  // 2. Check Database Storage
  const app = await GupshupApp.findOne({ gupshupAppId: appId }).lean();
  if (!app?.encryptedApiKey) return null;

  const expiresAt = app.appApiKeyExpiresAt || null;
  // If we have a DB token that is still fresh, we use it to avoid hitting Gupshup rate limits
  if (expiresAt && !isExpiringSoon(expiresAt)) {
    const token = decryptSecretCBC(app.encryptedApiKey);
    if (token) {
        // Backfill cache if we had a cache miss but DB hit
        const record: AppTokenCache = {
            appId,
            token,
            expiresAt: expiresAt.toISOString(),
            refreshedAt: app.appApiKeyRefreshedAt?.toISOString() || new Date().toISOString()
        };
        await writeJson(`${APP_TOKEN_CACHE_PREFIX}${appId}`, record, 3600);
        return token;
    }
  }

  return null;
}

export async function resolvePartnerToken(forceRefresh = false): Promise<string> {
  if (forceRefresh) {
    console.log('[GupshupTokenService] Forced refresh requested for Partner Token - clearing cache');
    await deleteCacheKey(PARTNER_TOKEN_CACHE_KEY);
    (partnerMemoryCache as any) = null;
  }

  // 1. Check Memory Cache (Fastest)
  if (!forceRefresh && partnerMemoryCache && partnerMemoryCache.expiresAt > Date.now()) {
    return partnerMemoryCache.token;
  }

  // 2. Check Redis Cache
  const cached = await readJson<PartnerTokenCache>(PARTNER_TOKEN_CACHE_KEY);
  
  // Prevent hammering forced refresh if it happened in last 30s
  const lastRefreshed = cached?.refreshedAt ? new Date(cached.refreshedAt).getTime() : 0;
  const isTooSoonForForce = Date.now() - lastRefreshed < 30000;

  if (forceRefresh && isTooSoonForForce && cached?.token) {
    console.log('[GupshupTokenService] Forced refresh ignored - already refreshed in last 30s');
    return cached.token;
  }

  if (!forceRefresh && cached?.token && !isExpiringSoon(cached.expiresAt)) {
    // Backfill memory cache
    (partnerMemoryCache as any) = { 
        token: cached.token, 
        expiresAt: Date.now() + MEMORY_CACHE_TTL_MS 
    };
    return cached.token;
  }

  const hasLoginCredentials = Boolean(config.gupshupPartnerEmail && (config.gupshupPartnerPassword || config.gupshupPartnerClientSecret));
  const envToken = normalizeToken(config.gupshupPartnerToken);

  // Static token can be used as fallback, but forced refresh should prefer a fresh login when possible.
  if (envToken && (!forceRefresh || !hasLoginCredentials)) {
    return envToken;
  }

  const lockKey = PARTNER_TOKEN_LOCK_KEY;
  const lockAcquired = await acquireLock(lockKey);

  if (!lockAcquired) {
    for (const delayMs of [150, 300, 600]) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      const retryCached = await readJson<PartnerTokenCache>(PARTNER_TOKEN_CACHE_KEY);
      if (retryCached?.token && !isExpiringSoon(retryCached.expiresAt)) {
        return retryCached.token;
      }
    }
  }

  try {
    if (hasLoginCredentials) {
      const fresh = await loginPartnerToken();
      await writeJson(PARTNER_TOKEN_CACHE_KEY, fresh, DEFAULT_PARTNER_TOKEN_TTL_SECONDS);
      return fresh.token;
    }

    if (envToken) {
      return envToken;
    }

    throw Object.assign(new Error('Gupshup partner credentials are not configured'), {
      status: 503,
      code: 'GUPSHUP_NOT_CONFIGURED'
    });
  } finally {
    await releaseLock(lockKey);
  }
}

export async function resolveAppToken(appId: string, forceRefresh = false): Promise<string> {
  if (forceRefresh) {
    console.log(`[GupshupTokenService] Forced refresh requested for App Token: ${appId} - clearing cache`);
    await deleteCacheKey(`${APP_TOKEN_CACHE_PREFIX}${appId}`);
    appMemoryCache.delete(appId);
  }

  // 1. Check Memory Cache (Fastest)
  const memCached = appMemoryCache.get(appId);
  if (!forceRefresh && memCached && memCached.expiresAt > Date.now()) {
    return memCached.token;
  }

  // 2. Check Redis Cache
  const cached = await readJson<AppTokenCache>(`${APP_TOKEN_CACHE_PREFIX}${appId}`);
  if (!forceRefresh && cached?.token && !isExpiringSoon(cached.expiresAt)) {
    // Backfill memory cache
    appMemoryCache.set(appId, { 
        token: cached.token, 
        expiresAt: Date.now() + MEMORY_CACHE_TTL_MS 
    });
    return cached.token;
  }

  const persisted = await readPersistedAppToken(appId);
  if (!forceRefresh && persisted) {
    return persisted;
  }

  const lockKey = `${APP_TOKEN_LOCK_PREFIX}${appId}`;
  const lockAcquired = await acquireLock(lockKey);

  if (!lockAcquired) {
    for (const delayMs of [150, 300, 600]) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      const retryCached = await readJson<AppTokenCache>(`${APP_TOKEN_CACHE_PREFIX}${appId}`);
      if (retryCached?.token && !isExpiringSoon(retryCached.expiresAt)) {
        return retryCached.token;
      }
      const retryPersisted = await readPersistedAppToken(appId);
      if (retryPersisted) {
        return retryPersisted;
      }
    }
  }

  try {
    let partnerToken = await resolvePartnerToken(forceRefresh);
    let fresh;
    try {
      fresh = await fetchAppToken(appId, partnerToken);
    } catch (error: any) {
      const status = Number(error?.response?.status || 0);
      if (!forceRefresh && (status === 401 || status === 403)) {
        partnerToken = await resolvePartnerToken(true);
        fresh = await fetchAppToken(appId, partnerToken);
      } else {
        throw error;
      }
    }
    await persistAppToken(appId, fresh);
    return fresh.token;
  } finally {
    await releaseLock(lockKey);
  }
}

export async function clearAppToken(appId: string) {
  await deleteCacheKey(`${APP_TOKEN_CACHE_PREFIX}${appId}`);
}