import axios from 'axios';
import { serviceRequest } from '../lib/service-client';

const DEFAULT_API_VERSION = 'v25.0';

type MetaAdsIntegrationConfig = {
  accessToken: string;
  tokenExpiresAt?: string;
  selected: {
    adAccountId: string;
    pageId: string;
    instagramActorId?: string;
    whatsappPhoneNumberId?: string;
    whatsappPhoneNumber?: string;
    productCatalogId?: string;
    productSetId?: string;
    currency?: string;
  };
  metadata?: any;
};

type MetaPublishResult = {
  campaign: any;
  adSet: any;
  creative: any;
  ad: any;
};

type MetaStatus = 'PAUSED' | 'ACTIVE';

function graphBase() {
  return `https://graph.facebook.com/${process.env.META_ADS_API_VERSION || DEFAULT_API_VERSION}`;
}

function encodeValue(value: any) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function normalizeAdAccountId(adAccountId: string) {
  const trimmed = String(adAccountId || '').trim();
  return trimmed.startsWith('act_') ? trimmed : `act_${trimmed}`;
}

function amountToMinorUnits(amount: number) {
  return Math.max(100, Math.round(Number(amount || 0) * 100));
}

function normalizeObjective(objective?: string) {
  const allowed = new Set([
    'OUTCOME_ENGAGEMENT',
    'OUTCOME_TRAFFIC',
    'OUTCOME_LEADS',
    'OUTCOME_SALES',
    'OUTCOME_AWARENESS',
    'OUTCOME_APP_PROMOTION',
  ]);
  const value = String(objective || 'OUTCOME_ENGAGEMENT').toUpperCase();
  return allowed.has(value) ? value : 'OUTCOME_ENGAGEMENT';
}

function normalizeBudgetType(raw?: string, hasEndTime = false) {
  return String(raw || '').toUpperCase() === 'LIFETIME' && hasEndTime ? 'LIFETIME' : 'DAILY';
}

function normalizeBidStrategy(raw?: string) {
  const value = String(raw || 'LOWEST_COST_WITHOUT_CAP').toUpperCase();
  if (['LOWEST_COST_WITHOUT_CAP', 'LOWEST_COST_WITH_BID_CAP', 'COST_CAP'].includes(value)) return value;
  return 'LOWEST_COST_WITHOUT_CAP';
}

function buildWaLink(phoneNumber: string, welcomeMessage?: string) {
  const phone = String(phoneNumber || '').replace(/[^\d]/g, '');
  const url = new URL(`https://wa.me/${phone}`);
  if (welcomeMessage) url.searchParams.set('text', welcomeMessage);
  return url.toString();
}

function normalizeCallToActionType(raw?: string) {
  const value = String(raw || 'WHATSAPP_MESSAGE').toUpperCase();
  return value === 'WHATSAPP_MESSAGE' ? value : 'WHATSAPP_MESSAGE';
}

function buildWhatsAppCallToAction(ad: any, selected: MetaAdsIntegrationConfig['selected'], waLink: string, whatsappNumber: string, selectedPhoneNumberId?: string) {
  return {
    type: normalizeCallToActionType(ad.callToActionType),
    value: {
      app_destination: 'WHATSAPP',
      link: waLink,
      page_id: selected.pageId,
      whatsapp_number: whatsappNumber || undefined,
      whatsapp_business_phone_number_id: selectedPhoneNumberId,
    },
  };
}

function buildCarouselCards(ad: any, waLink: string) {
  const cards = Array.isArray(ad.carouselCards) ? ad.carouselCards : [];
  return cards
    .filter((card: any) => card?.headline || card?.imageHash || card?.imageUrl)
    .slice(0, 10)
    .map((card: any, index: number) => ({
      link: card.link || waLink,
      name: card.headline || `${ad.headline || ad.name} ${index + 1}`,
      description: card.description || ad.description || undefined,
      image_hash: card.imageHash || undefined,
      picture: card.imageUrl || undefined,
    }));
}

function mapStringArray(value: any) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

function buildTargeting(targeting: any = {}) {
  const countries = Array.isArray(targeting.countries) && targeting.countries.length
    ? targeting.countries
    : ['IN'];
  const genderValues = Array.isArray(targeting.genders)
    ? targeting.genders
        .filter((gender: string) => gender !== 'ALL')
        .map((gender: string) => gender === 'MALE' ? 1 : gender === 'FEMALE' ? 2 : undefined)
        .filter(Boolean)
    : [];

  const payload: any = {
    geo_locations: { countries },
    age_min: Number(targeting.ageMin || 18),
    age_max: Number(targeting.ageMax || 65),
  };

  if (genderValues.length) payload.genders = genderValues;
  if (Array.isArray(targeting.interests) && targeting.interests.length) {
    payload.flexible_spec = [{
      interests: targeting.interests.map((id: string) => ({ id })),
    }];
  }
  if (Array.isArray(targeting.behaviors) && targeting.behaviors.length) {
    payload.flexible_spec = [
      ...(payload.flexible_spec || []),
      { behaviors: targeting.behaviors.map((id: string) => ({ id })) },
    ];
  }
  if (Array.isArray(targeting.customAudiences) && targeting.customAudiences.length) {
    payload.custom_audiences = targeting.customAudiences.map((id: string) => ({ id }));
  }
  if (Array.isArray(targeting.excludedAudiences) && targeting.excludedAudiences.length) {
    payload.excluded_custom_audiences = targeting.excludedAudiences.map((id: string) => ({ id }));
  }
  const publisherPlatforms = mapStringArray(targeting.publisherPlatforms);
  const facebookPositions = mapStringArray(targeting.facebookPositions);
  const instagramPositions = mapStringArray(targeting.instagramPositions);
  const devicePlatforms = mapStringArray(targeting.devicePlatforms);

  if (publisherPlatforms.length) payload.publisher_platforms = publisherPlatforms;
  if (facebookPositions.length) payload.facebook_positions = facebookPositions;
  if (instagramPositions.length) payload.instagram_positions = instagramPositions;
  if (devicePlatforms.length) payload.device_platforms = devicePlatforms;

  return payload;
}

function sumActionValues(items: any[] = [], actionTypes: string[]) {
  return items.reduce((sum, item) => {
    const actionType = String(item?.action_type || '').toLowerCase();
    return actionTypes.some((type) => actionType === type || actionType.includes(type))
      ? sum + Number(item?.value || 0)
      : sum;
  }, 0);
}

function findCostPerAction(items: any[] = [], actionTypes: string[]) {
  const match = items.find((item) => {
    const actionType = String(item?.action_type || '').toLowerCase();
    return actionTypes.some((type) => actionType === type || actionType.includes(type));
  });
  return match ? Number(match.value || 0) : 0;
}

export function parseMetaInsightsRow(row: any = {}) {
  const actions = Array.isArray(row.actions) ? row.actions : [];
  const conversions = Array.isArray(row.conversions) ? row.conversions : [];
  const costPerActionType = Array.isArray(row.cost_per_action_type) ? row.cost_per_action_type : [];
  const resultActionTypes = [
    'onsite_conversion.messaging_conversation_started_7d',
    'onsite_conversion.messaging_conversation_started',
    'messaging_conversation_started',
    'onsite_conversion.messaging_first_reply',
    'offsite_conversion.fb_pixel_lead',
    'onsite_conversion.lead',
    'onsite_conversion.lead_grouped',
    'omni_lead',
    'lead',
  ];
  const resultCount = sumActionValues(actions, resultActionTypes);
  const conversionCount = conversions.length
    ? conversions.reduce((sum: number, item: any) => sum + Number(item.value || 0), 0)
    : resultCount;

  return {
    spentAmount: Number(row.spend || 0),
    impressions: Number(row.impressions || 0),
    reach: Number(row.reach || 0),
    frequency: Number(row.frequency || 0),
    clicks: Number(row.clicks || 0),
    inlineLinkClicks: Number(row.inline_link_clicks || 0),
    ctr: Number(row.ctr || 0),
    cpc: Number(row.cpc || 0),
    cpm: Number(row.cpm || 0),
    conversions: conversionCount,
    results: resultCount,
    costPerResult: findCostPerAction(costPerActionType, resultActionTypes),
    qualityRanking: row.quality_ranking,
    engagementRateRanking: row.engagement_rate_ranking,
    conversionRateRanking: row.conversion_rate_ranking,
    actionBreakdown: actions,
    costPerActionType,
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

export class MetaMarketingService {
  static async getWorkspaceConfig(workspaceId: string): Promise<MetaAdsIntegrationConfig> {
    const response = await serviceRequest('automation', {
      method: 'GET',
      url: `/internal/v1/integrations/meta-ads/${workspaceId}`,
    }, { retries: 1 });

    if (response.status >= 400 || !(response.data as any)?.success) {
      throw new Error((response.data as any)?.message || 'Meta Ads is not connected for this workspace.');
    }

    return (response.data as any).data;
  }

  static async createClickToWhatsAppAd(workspaceId: string, ad: any, desiredStatus: MetaStatus = 'PAUSED'): Promise<MetaPublishResult> {
    const config = await this.getWorkspaceConfig(workspaceId);
    const selected = config.selected;
    const accessToken = config.accessToken;
    const adAccountId = normalizeAdAccountId(selected.adAccountId);
    const whatsappNumber = selected.whatsappPhoneNumber || ad.whatsappPhoneNumber || '';
    const waLink = buildWaLink(whatsappNumber, ad.welcomeMessage);
    const status = desiredStatus === 'ACTIVE' ? 'ACTIVE' : 'PAUSED';
    const objective = normalizeObjective(ad.metaObjective);
    const budgetType = normalizeBudgetType(ad.budgetType, Boolean(ad.scheduleEnd));
    const bidStrategy = normalizeBidStrategy(ad.bidStrategy);
    const budgetPayload = budgetType === 'LIFETIME'
      ? { lifetime_budget: amountToMinorUnits(ad.budget) }
      : { daily_budget: amountToMinorUnits(ad.budget) };
    const selectedPhoneNumberId = selected.whatsappPhoneNumberId || ad.phoneNumberId || undefined;

    const campaign = await graphPost(`/${adAccountId}/campaigns`, {
      name: ad.name,
      objective,
      status: 'PAUSED',
      special_ad_categories: [],
    }, accessToken);

    const adSet = await graphPost(`/${adAccountId}/adsets`, {
      name: `${ad.name} Ad Set`,
      campaign_id: campaign.data.id,
      ...budgetPayload,
      billing_event: ad.billingEvent || 'IMPRESSIONS',
      optimization_goal: ad.optimizationGoal || 'CONVERSATIONS',
      destination_type: ad.destinationType || 'WHATSAPP',
      bid_strategy: bidStrategy,
      bid_amount: bidStrategy === 'LOWEST_COST_WITHOUT_CAP' || !Number(ad.bidAmount)
        ? undefined
        : amountToMinorUnits(ad.bidAmount),
      start_time: ad.scheduleStart ? new Date(ad.scheduleStart).toISOString() : undefined,
      end_time: ad.scheduleEnd ? new Date(ad.scheduleEnd).toISOString() : undefined,
      targeting: buildTargeting(ad.targeting),
      promoted_object: {
        page_id: selected.pageId,
        whatsapp_phone_number: whatsappNumber || undefined,
        whatsapp_business_phone_number_id: selectedPhoneNumberId,
      },
      status: 'PAUSED',
    }, accessToken);

    const callToAction = buildWhatsAppCallToAction(ad, selected, waLink, whatsappNumber, selectedPhoneNumberId);
    const creativeStorySpec: any = {
      page_id: selected.pageId,
      link_data: {
        message: ad.primaryText || ad.welcomeMessage || ad.name,
        link: waLink,
        name: ad.headline || ad.ctaText || 'Message us on WhatsApp',
        description: ad.description || undefined,
        call_to_action: callToAction,
      },
    };
    if (selected.instagramActorId) creativeStorySpec.instagram_actor_id = selected.instagramActorId;
    const carouselCards = String(ad.displayFormat || '').toUpperCase() === 'CAROUSEL'
      ? buildCarouselCards(ad, waLink)
      : [];
    if (carouselCards.length) {
      creativeStorySpec.link_data.child_attachments = carouselCards;
    } else {
      if (ad.imageHash) creativeStorySpec.link_data.image_hash = ad.imageHash;
      if (ad.imageUrl) creativeStorySpec.link_data.picture = ad.imageUrl;
    }

    const creative = await graphPost(`/${adAccountId}/adcreatives`, {
      name: `${ad.name} Creative`,
      object_story_spec: creativeStorySpec,
      url_tags: ad.urlTags || undefined,
    }, accessToken);

    const createdAd = await graphPost(`/${adAccountId}/ads`, {
      name: ad.name,
      adset_id: adSet.data.id,
      creative: { creative_id: creative.data.id },
      status,
    }, accessToken);

    return {
      campaign,
      adSet,
      creative,
      ad: createdAd,
    };
  }

  static async updateAdStatus(workspaceId: string, metaAdId: string, status: 'ACTIVE' | 'PAUSED') {
    const config = await this.getWorkspaceConfig(workspaceId);
    return graphPost(`/${metaAdId}`, { status }, config.accessToken);
  }

  static async getAdStatus(workspaceId: string, metaAdId: string) {
    const config = await this.getWorkspaceConfig(workspaceId);
    return graphGet(`/${metaAdId}`, {
      fields: 'id,name,status,effective_status,configured_status,review_feedback,adset{id,name,status,effective_status,configured_status,daily_budget,lifetime_budget,bid_strategy,bid_amount,billing_event,optimization_goal,targeting},campaign{id,name,status,effective_status,configured_status,objective}',
    }, config.accessToken);
  }

  static async getInsights(workspaceId: string, metaAdId: string, since?: string, until?: string) {
    const config = await this.getWorkspaceConfig(workspaceId);
    return graphGet(`/${metaAdId}/insights`, {
      fields: 'spend,impressions,reach,frequency,clicks,inline_link_clicks,ctr,cpc,cpm,cpp,actions,cost_per_action_type,conversions,cost_per_conversion,quality_ranking,engagement_rate_ranking,conversion_rate_ranking,date_start,date_stop',
      time_range: since && until ? { since, until } : undefined,
    }, config.accessToken);
  }

  static async getAdPreview(workspaceId: string, metaAdId: string, adFormat = 'DESKTOP_FEED_STANDARD') {
    const config = await this.getWorkspaceConfig(workspaceId);
    return graphGet(`/${metaAdId}/previews`, {
      ad_format: adFormat,
      fields: 'body',
    }, config.accessToken);
  }
}
