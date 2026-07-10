import axios from 'axios';

const DEFAULT_API_VERSION = 'v25.0';
const DEFAULT_SCOPES = [
  'ads_management',
  'ads_read',
  'business_management',
  'catalog_management',
  'pages_show_list',
  'pages_read_engagement',
  'whatsapp_business_management',
];

type MetaAdsState = {
  workspaceId?: string;
  userId?: string;
  redirectUri?: string;
  returnTo?: string;
};

type MetaAdsTokenResponse = {
  accessToken: string;
  tokenType?: string;
  expiresIn?: number;
  expiresAt?: Date;
};

function csv(value: string | undefined, fallback: string[]) {
  return (value || fallback.join(','))
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function requireMetaEnv() {
  if (!process.env.META_ADS_CLIENT_ID || !process.env.META_ADS_CLIENT_SECRET) {
    throw new Error('Meta Ads integration is not configured. Set META_ADS_CLIENT_ID and META_ADS_CLIENT_SECRET.');
  }
}

function graphBase(apiVersion = MetaAdsService.getApiVersion()) {
  return `https://graph.facebook.com/${apiVersion}`;
}

function normalizeTokenResponse(data: any): MetaAdsTokenResponse {
  if (!data?.access_token) {
    throw new Error('Meta did not return an access token.');
  }

  const expiresIn = data.expires_in ? Number(data.expires_in) : undefined;
  return {
    accessToken: data.access_token,
    tokenType: data.token_type,
    expiresIn,
    expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : undefined,
  };
}

function normalizeAdAccountId(adAccountId: string) {
  const trimmed = String(adAccountId || '').trim();
  if (!trimmed) return '';
  return trimmed.startsWith('act_') ? trimmed : `act_${trimmed}`;
}

function encodeValue(value: any) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function uniqueById(items: any[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const id = String(item?.id || '').trim();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

async function graphGet(path: string, params: Record<string, any>, accessToken: string) {
  const response = await axios.get(`${graphBase()}${path}`, {
    params: { ...params, access_token: accessToken },
    validateStatus: () => true,
  });

  if (response.status >= 400 || response.data?.error) {
    const message = response.data?.error?.message || `Meta API request failed with status ${response.status}`;
    const error = new Error(message) as Error & { response?: any; meta?: any };
    error.response = response;
    error.meta = response.data?.error;
    throw error;
  }

  return {
    data: response.data,
    metaRequestId: response.headers['x-fb-request-id'] || response.headers['x-fb-trace-id'],
  };
}

async function graphPost(path: string, payload: Record<string, any>, accessToken: string) {
  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(payload)) {
    const encoded = encodeValue(value);
    if (encoded !== undefined) form.set(key, encoded);
  }
  form.set('access_token', accessToken);

  const response = await axios.post(`${graphBase()}${path}`, form, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    validateStatus: () => true,
  });

  if (response.status >= 400 || response.data?.error) {
    const message = response.data?.error?.message || `Meta API request failed with status ${response.status}`;
    const error = new Error(message) as Error & { response?: any; meta?: any };
    error.response = response;
    error.meta = response.data?.error;
    throw error;
  }

  return {
    data: response.data,
    metaRequestId: response.headers['x-fb-request-id'] || response.headers['x-fb-trace-id'],
  };
}

function normalizeCatalogProduct(product: any = {}) {
  const retailerId = String(product.retailerId || product.retailer_id || product._id || product.id || '').trim();
  const name = String(product.name || '').trim();
  const currency = String(product.currency || 'INR').trim().toUpperCase();
  const price = Number(product.price || 0);
  const imageUrl = String(product.imageUrl || product.image_url || product.images?.find?.((image: any) => image?.isPrimary)?.url || product.images?.[0]?.url || '').trim();
  const url = String(product.url || product.link || imageUrl || '').trim();
  const stock = Number(product.stock ?? product.inventory ?? 0);

  if (!retailerId) throw new Error('Product retailer ID is required for Meta catalog sync.');
  if (!name) throw new Error('Product name is required for Meta catalog sync.');
  if (!price || price < 0) throw new Error('Product price must be greater than or equal to zero.');
  if (!url) throw new Error('Product URL or image URL is required for Meta catalog sync.');

  return {
    retailer_id: retailerId,
    name,
    description: String(product.description || name).slice(0, 5000),
    availability: stock > 0 ? 'in stock' : 'out of stock',
    inventory: Math.max(0, Math.floor(stock)),
    condition: String(product.condition || 'new').toLowerCase(),
    price: `${price.toFixed(2)} ${currency}`,
    currency,
    url,
    image_url: imageUrl || undefined,
    brand: String(product.brand || product.vendor || 'ConnectSphere').trim(),
    category: product.category ? String(product.category).trim() : undefined,
    product_type: product.category ? String(product.category).trim() : undefined,
    visibility: product.isActive === false ? 'staging' : 'published',
  };
}

export class MetaAdsService {
  static getApiVersion() {
    return process.env.META_ADS_API_VERSION || process.env.INSTAGRAM_API_VERSION || DEFAULT_API_VERSION;
  }

  static getScopes() {
    return csv(process.env.META_ADS_SCOPES, DEFAULT_SCOPES);
  }

  static generateAuthUrl(params: {
    workspaceId: string;
    userId?: string;
    redirectUri: string;
    returnTo?: string;
    forceReauth?: boolean;
  }) {
    requireMetaEnv();

    const state = Buffer.from(JSON.stringify({
      workspaceId: params.workspaceId,
      userId: params.userId,
      redirectUri: params.redirectUri,
      returnTo: params.returnTo,
    })).toString('base64url');

    const url = new URL(`https://www.facebook.com/${this.getApiVersion()}/dialog/oauth`);
    url.searchParams.set('client_id', process.env.META_ADS_CLIENT_ID!);
    url.searchParams.set('redirect_uri', params.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', this.getScopes().join(','));
    url.searchParams.set('state', state);
    if (params.forceReauth) url.searchParams.set('auth_type', 'rerequest');

    return url.toString();
  }

  static parseState(rawState: unknown): MetaAdsState {
    if (typeof rawState !== 'string' || !rawState) return {};
    try {
      return JSON.parse(Buffer.from(rawState, 'base64url').toString('utf8'));
    } catch {
      return {};
    }
  }

  static async exchangeCode(code: string, redirectUri: string) {
    requireMetaEnv();
    const response = await axios.get(`${graphBase()}/oauth/access_token`, {
      params: {
        client_id: process.env.META_ADS_CLIENT_ID,
        client_secret: process.env.META_ADS_CLIENT_SECRET,
        redirect_uri: redirectUri,
        code,
      },
    });

    return normalizeTokenResponse(response.data);
  }

  static async exchangeForLongLivedToken(shortLivedAccessToken: string) {
    requireMetaEnv();
    const response = await axios.get(`${graphBase()}/oauth/access_token`, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: process.env.META_ADS_CLIENT_ID,
        client_secret: process.env.META_ADS_CLIENT_SECRET,
        fb_exchange_token: shortLivedAccessToken,
      },
    });

    return normalizeTokenResponse(response.data);
  }

  static async getProfile(accessToken: string) {
    const response = await axios.get(`${graphBase()}/me`, {
      params: {
        fields: 'id,name,email',
        access_token: accessToken,
      },
    });

    return response.data;
  }

  static async getDebugToken(accessToken: string) {
    requireMetaEnv();
    const response = await axios.get(`${graphBase()}/debug_token`, {
      params: {
        input_token: accessToken,
        access_token: `${process.env.META_ADS_CLIENT_ID}|${process.env.META_ADS_CLIENT_SECRET}`,
      },
    });

    return response.data?.data || {};
  }

  static async listAdAccounts(accessToken: string) {
    const response = await axios.get(`${graphBase()}/me/adaccounts`, {
      params: {
        fields: [
          'id',
          'account_id',
          'name',
          'currency',
          'account_status',
          'timezone_name',
          'business{id,name}',
          'amount_spent',
          'balance',
          'disable_reason',
        ].join(','),
        limit: 100,
        access_token: accessToken,
      },
    });

    return Array.isArray(response.data?.data) ? response.data.data : [];
  }

  static async listPages(accessToken: string) {
    const response = await axios.get(`${graphBase()}/me/accounts`, {
      params: {
        fields: [
          'id',
          'name',
          'access_token',
          'instagram_business_account{id,username}',
          'picture{url}',
        ].join(','),
        limit: 100,
        access_token: accessToken,
      },
    });

    return Array.isArray(response.data?.data) ? response.data.data : [];
  }

  static async listWhatsAppAssets(accessToken: string) {
    const response = await axios.get(`${graphBase()}/me/businesses`, {
      params: {
        fields: [
          'id',
          'name',
          'owned_whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number,verified_name,quality_rating}}',
          'client_whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number,verified_name,quality_rating}}',
        ].join(','),
        limit: 50,
        access_token: accessToken,
      },
    });

    const businesses = Array.isArray(response.data?.data) ? response.data.data : [];
    return businesses.flatMap((business: any) => {
      const owned = business.owned_whatsapp_business_accounts?.data || [];
      const client = business.client_whatsapp_business_accounts?.data || [];
      return [...owned, ...client].flatMap((waba: any) => {
        const phoneNumbers = waba.phone_numbers?.data || [];
        return phoneNumbers.map((phone: any) => ({
          ...phone,
          wabaId: waba.id,
          wabaName: waba.name,
          businessId: business.id,
          businessName: business.name,
        }));
      });
    });
  }

  static async listBusinesses(accessToken: string) {
    const response = await axios.get(`${graphBase()}/me/businesses`, {
      params: {
        fields: 'id,name',
        limit: 50,
        access_token: accessToken,
      },
    });

    return Array.isArray(response.data?.data) ? response.data.data : [];
  }

  static async listCatalogEdge(accessToken: string, business: any, edge: 'owned_product_catalogs' | 'client_product_catalogs') {
    const response = await axios.get(`${graphBase()}/${business.id}/${edge}`, {
      params: {
        fields: [
          'id',
          'name',
          'vertical',
          'product_count',
          'feed_count',
          'owner_business{id,name}',
        ].join(','),
        limit: 100,
        access_token: accessToken,
      },
    });

    const catalogs = Array.isArray(response.data?.data) ? response.data.data : [];
    return catalogs.map((catalog: any) => ({
      ...catalog,
      accessType: edge === 'owned_product_catalogs' ? 'owned' : 'client',
      businessId: business.id,
      businessName: business.name,
    }));
  }

  static async listProductSets(accessToken: string, catalogId: string) {
    if (!catalogId) return [];
    const response = await axios.get(`${graphBase()}/${catalogId}/product_sets`, {
      params: {
        fields: [
          'id',
          'name',
          'product_count',
          'retailer_id',
          'filter',
        ].join(','),
        limit: 100,
        access_token: accessToken,
      },
    });

    return Array.isArray(response.data?.data) ? response.data.data : [];
  }

  static async listCatalogProducts(accessToken: string, catalogId: string, limit = 50) {
    if (!catalogId) throw new Error('Product catalog is required.');
    return graphGet(`/${catalogId}/products`, {
      fields: [
        'id',
        'retailer_id',
        'name',
        'description',
        'price',
        'currency',
        'availability',
        'inventory',
        'image_url',
        'url',
        'brand',
        'category',
        'product_type',
        'review_status',
        'status',
        'visibility',
      ].join(','),
      limit: Math.min(Math.max(Number(limit || 50), 1), 100),
    }, accessToken);
  }

  static async syncCatalogProduct(accessToken: string, catalogId: string, product: any) {
    if (!catalogId) throw new Error('Product catalog is required.');
    const payload = normalizeCatalogProduct(product);
    const metaProductId = String(product.metaProductId || product.meta_product_id || '').trim();

    if (metaProductId && !String(metaProductId).startsWith('local_')) {
      const response = await graphPost(`/${metaProductId}`, payload, accessToken);
      return { ...response, action: 'updated', retailerId: payload.retailer_id };
    }

    const response = await graphPost(`/${catalogId}/products`, payload, accessToken);
    return { ...response, action: 'created', retailerId: payload.retailer_id };
  }

  static async createProductSet(accessToken: string, catalogId: string, params: { name: string; filter?: any }) {
    if (!catalogId) throw new Error('Product catalog is required.');
    if (!params.name) throw new Error('Product set name is required.');
    return graphPost(`/${catalogId}/product_sets`, {
      name: params.name,
      filter: params.filter || { product_type: { i_contains: params.name } },
    }, accessToken);
  }

  static async listProductCatalogs(accessToken: string) {
    const businesses = await this.listBusinesses(accessToken).catch(() => []);
    const catalogGroups = await Promise.all(
      businesses.flatMap((business: any) => [
        this.listCatalogEdge(accessToken, business, 'owned_product_catalogs').catch(() => []),
        this.listCatalogEdge(accessToken, business, 'client_product_catalogs').catch(() => []),
      ])
    );

    const catalogs = uniqueById(catalogGroups.flat());
    const productSetGroups = await Promise.all(
      catalogs.slice(0, 25).map((catalog: any) =>
        this.listProductSets(accessToken, catalog.id)
          .then((sets) => sets.map((set: any) => ({
            ...set,
            productCatalogId: catalog.id,
            productCatalogName: catalog.name,
          })))
          .catch(() => [])
      )
    );

    return {
      catalogs,
      productSets: uniqueById(productSetGroups.flat()),
    };
  }

  static async discoverAssets(accessToken: string) {
    const [profile, debugToken, adAccounts, pages, whatsappPhoneNumbers, commerceAssets] = await Promise.all([
      this.getProfile(accessToken).catch(() => null),
      this.getDebugToken(accessToken).catch(() => null),
      this.listAdAccounts(accessToken).catch(() => []),
      this.listPages(accessToken).catch(() => []),
      this.listWhatsAppAssets(accessToken).catch(() => []),
      this.listProductCatalogs(accessToken).catch(() => ({ catalogs: [], productSets: [] })),
    ]);

    return {
      profile,
      debugToken,
      adAccounts,
      pages,
      whatsappPhoneNumbers,
      productCatalogs: commerceAssets.catalogs,
      productSets: commerceAssets.productSets,
    };
  }

  static toSafeAssets(assets: any) {
    return {
      ...(assets || {}),
      pages: (assets?.pages || []).map((page: any) => {
        const { access_token, ...safePage } = page;
        return safePage;
      }),
    };
  }

  static normalizeSelectedConfig(config: any) {
    return {
      adAccountId: normalizeAdAccountId(config?.adAccountId || config?.accountId),
      pageId: String(config?.pageId || '').trim(),
      instagramActorId: String(config?.instagramActorId || '').trim() || undefined,
      whatsappPhoneNumberId: String(config?.whatsappPhoneNumberId || '').trim(),
      whatsappPhoneNumber: String(config?.whatsappPhoneNumber || '').replace(/[^\d]/g, ''),
      productCatalogId: String(config?.productCatalogId || '').trim() || undefined,
      productSetId: String(config?.productSetId || '').trim() || undefined,
      currency: String(config?.currency || '').trim().toUpperCase() || undefined,
    };
  }
}
