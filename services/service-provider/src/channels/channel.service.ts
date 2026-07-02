import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ProviderEventProducerService } from '../common/provider-event-producer.service';
import { config } from '../config';
import { ProviderApp } from '../models/provider-app.schema';

const GRAPH_URL = 'https://graph.facebook.com';
const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v18.0';
const INSTAGRAM_OAUTH_URL = 'https://www.instagram.com/oauth/authorize';
const INSTAGRAM_TOKEN_URL = 'https://api.instagram.com/oauth/access_token';
const INSTAGRAM_GRAPH_URL = 'https://graph.instagram.com';

type ChannelProvider = 'facebook' | 'instagram' | 'sms' | 'meta';

type InstagramTokenResponse = {
  accessToken: string;
  userId?: string;
  permissions: string[];
};

type InstagramGraphMethod = 'GET' | 'POST' | 'DELETE';

type InstagramGraphHost = 'instagram' | 'facebook';

type InstagramGraphRequest = {
  accessToken: string;
  method?: InstagramGraphMethod;
  path: string;
  query?: Record<string, any>;
  body?: Record<string, any>;
  graphHost?: InstagramGraphHost;
  apiVersion?: string;
};

function requireInstagramConfig() {
  if (!config.instagram.clientId || !config.instagram.clientSecret) {
    throw new ServiceUnavailableException({
      code: 'INSTAGRAM_PROVIDER_NOT_CONFIGURED',
      message: 'Instagram provider is not configured. Set INSTAGRAM_CLIENT_ID and INSTAGRAM_CLIENT_SECRET on service-provider.',
    });
  }
}

function parseInstagramTokenPayload(payload: any): InstagramTokenResponse {
  const data = Array.isArray(payload?.data) ? payload.data[0] : payload;
  const permissions = Array.isArray(data?.permissions)
    ? data.permissions
    : String(data?.permissions || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

  if (!data?.access_token) {
    throw new Error('Instagram did not return an access token.');
  }

  return {
    accessToken: data.access_token,
    userId: data.user_id || data.id,
    permissions,
  };
}

function compactParams(input: Record<string, any> = {}) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      params.set(key, value.join(','));
    } else if (typeof value === 'object') {
      params.set(key, JSON.stringify(value));
    } else {
      params.set(key, String(value));
    }
  }

  return params;
}

function cleanGraphPath(path: string) {
  const cleaned = String(path || '').trim().replace(/^\/+/, '');
  if (!cleaned || cleaned.includes('..') || /^https?:\/\//i.test(cleaned)) {
    throw new Error('A valid relative Instagram Graph path is required.');
  }
  return cleaned;
}

@Injectable()
export class ChannelService {
  constructor(
    @InjectModel(ProviderApp.name) private readonly appModel: Model<ProviderApp>,
    private readonly eventProducer: ProviderEventProducerService,
  ) {}

  async getFacebookPages(accessToken: string) {
    const response = await fetch(`${GRAPH_URL}/${GRAPH_VERSION}/me/accounts?` + new URLSearchParams({
      access_token: accessToken,
      fields: 'id,name,category,about,website,phone,emails,location,picture',
    }));
    const body = await response.json() as any;
    if (!response.ok) throw new Error(body?.error?.message || 'Failed to fetch Facebook pages');
    return (body.data || []).map((page: any) => ({
      id: page.id,
      name: page.name,
      category: page.category,
      about: page.about,
      website: page.website,
      phone: page.phone,
      emails: page.emails,
      location: page.location,
      picture: page.picture?.data?.url,
    }));
  }

  async getInstagramAccounts(accessToken: string) {
    const pages = await this.getFacebookPages(accessToken);
    const accounts = [];
    for (const page of pages) {
      const accountResponse = await fetch(`${GRAPH_URL}/${GRAPH_VERSION}/${page.id}?` + new URLSearchParams({
        fields: 'instagram_business_account',
        access_token: accessToken,
      }));
      const accountBody = await accountResponse.json() as any;
      const igAccountId = accountBody?.instagram_business_account?.id;
      if (!igAccountId) continue;

      const detailsResponse = await fetch(`${GRAPH_URL}/${GRAPH_VERSION}/${igAccountId}?` + new URLSearchParams({
        fields: 'id,username,name,profile_picture_url,biography',
        access_token: accessToken,
      }));
      const details = await detailsResponse.json();
      accounts.push({ pageId: page.id, pageName: page.name, instagramAccount: details });
    }
    return accounts;
  }

  generateInstagramAuthUrl(params: {
    workspaceId: string;
    userId?: string;
    redirectUri: string;
    returnTo?: string;
    forceReauth?: boolean;
  }) {
    requireInstagramConfig();

    const state = Buffer.from(JSON.stringify({
      workspaceId: params.workspaceId,
      userId: params.userId,
      redirectUri: params.redirectUri,
      returnTo: params.returnTo,
    })).toString('base64url');

    const url = new URL(INSTAGRAM_OAUTH_URL);
    url.searchParams.set('client_id', config.instagram.clientId);
    url.searchParams.set('redirect_uri', params.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', config.instagram.scopes.join(','));
    url.searchParams.set('state', state);
    url.searchParams.set('enable_fb_login', '0');
    if (params.forceReauth) {
      url.searchParams.set('force_reauth', '1');
      url.searchParams.set('force_authentication', '1');
    }

    return {
      url: url.toString(),
      scopes: config.instagram.scopes,
      subscribedFields: config.instagram.subscribedFields,
    };
  }

  parseInstagramState(rawState: unknown) {
    if (typeof rawState !== 'string' || !rawState) return {};
    try {
      return JSON.parse(Buffer.from(rawState, 'base64url').toString('utf8'));
    } catch {
      return {};
    }
  }

  async completeInstagramOAuth(
    code: string,
    redirectUri: string,
    context: { workspaceId?: string; userId?: string } = {},
  ) {
    const shortLivedToken = await this.exchangeInstagramCode(code, redirectUri);
    const longLivedToken = await this.exchangeInstagramLongLivedToken(shortLivedToken.accessToken);
    const profile = await this.getInstagramProfile(longLivedToken.accessToken);
    const instagramAccountId = profile.user_id || shortLivedToken.userId || profile.id;

    let webhookSubscription: any = {
      success: false,
      fields: config.instagram.subscribedFields,
    };

    try {
      webhookSubscription = await this.subscribeInstagramWebhookFields(
        String(instagramAccountId),
        longLivedToken.accessToken,
      );
    } catch (err: any) {
      webhookSubscription = {
        ...webhookSubscription,
        error: err?.message || 'Instagram webhook subscription failed.',
        code: err?.code,
      };
    }

    if (context.workspaceId && instagramAccountId) {
      await this.upsertInstagramAppMapping({
        workspaceId: context.workspaceId,
        instagramAccountId: String(instagramAccountId),
        appScopedUserId: profile.id || shortLivedToken.userId,
        profile,
        tokenExpiresAt: longLivedToken.expiresAt,
      });
    }

    return {
      instagramAccountId,
      appScopedUserId: profile.id || shortLivedToken.userId,
      permissions: shortLivedToken.permissions,
      requestedScopes: config.instagram.scopes,
      subscribedFields: config.instagram.subscribedFields,
      profile,
      longLivedToken,
      webhookSubscription,
    };
  }

  private async upsertInstagramAppMapping(input: {
    workspaceId: string;
    instagramAccountId: string;
    appScopedUserId?: string;
    profile: any;
    tokenExpiresAt?: string;
  }) {
    const now = new Date();
    const orQuery: any[] = [
      { appId: `instagram:${input.instagramAccountId}` },
      { 'providerData.instagramAccountId': input.instagramAccountId },
    ];
    if (input.appScopedUserId) {
      orQuery.push({ 'providerData.appScopedUserId': input.appScopedUserId });
    }

    await this.appModel.findOneAndUpdate(
      {
        workspaceId: input.workspaceId,
        $or: orQuery,
      },
      {
        $set: {
          workspaceId: input.workspaceId,
          provider: 'instagram',
          appId: `instagram:${input.instagramAccountId}`,
          appName: input.profile?.username ? `Instagram @${input.profile.username}` : 'Instagram Business',
          status: 'active',
          connectedAt: now,
          tokenExpiresAt: input.tokenExpiresAt ? new Date(input.tokenExpiresAt) : undefined,
          providerData: {
            provider: 'instagram',
            instagramAccountId: input.instagramAccountId,
            appScopedUserId: input.appScopedUserId,
            username: input.profile?.username,
            displayName: input.profile?.name,
            accountType: input.profile?.account_type,
            profilePictureUrl: input.profile?.profile_picture_url,
            mediaCount: input.profile?.media_count,
            followersCount: input.profile?.followers_count,
            followsCount: input.profile?.follows_count,
            lastConnectedAt: now.toISOString(),
          },
        },
      },
      { upsert: true, new: true },
    ).exec();
  }

  async refreshInstagramToken(accessToken: string) {
    const response = await fetch(`${INSTAGRAM_GRAPH_URL}/refresh_access_token?` + new URLSearchParams({
      grant_type: 'ig_refresh_token',
      access_token: accessToken,
    }));
    const body = await response.json() as any;
    if (!response.ok) throw new Error(body?.error?.message || 'Failed to refresh Instagram access token');

    const refreshedToken = body?.access_token;
    if (!refreshedToken) throw new Error('Instagram did not return a refreshed access token.');

    return {
      accessToken: refreshedToken,
      tokenType: body?.token_type,
      expiresIn: Number(body?.expires_in || 0),
      expiresAt: body?.expires_in
        ? new Date(Date.now() + Number(body.expires_in) * 1000).toISOString()
        : undefined,
    };
  }

  async instagramGraph(input: InstagramGraphRequest) {
    if (!input.accessToken) throw new Error('Instagram accessToken is required.');

    const method = (input.method || 'GET').toUpperCase() as InstagramGraphMethod;
    if (!['GET', 'POST', 'DELETE'].includes(method)) {
      throw new Error(`Unsupported Instagram Graph method: ${method}`);
    }

    const graphHost = input.graphHost === 'facebook' ? GRAPH_URL : INSTAGRAM_GRAPH_URL;
    const apiVersion = input.apiVersion || config.instagram.apiVersion;
    const path = cleanGraphPath(input.path);
    const query = compactParams({
      ...(input.query || {}),
      access_token: input.accessToken,
    });
    const url = `${graphHost}/${apiVersion}/${path}${query.toString() ? `?${query.toString()}` : ''}`;
    const body = compactParams(input.body || {});
    const hasBody = method !== 'GET' && body.toString().length > 0;

    const response = await fetch(url, {
      method,
      headers: {
        authorization: `Bearer ${input.accessToken}`,
        ...(hasBody ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
      },
      body: hasBody ? body : undefined,
    });

    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const message = typeof payload === 'object'
        ? (payload as any)?.error?.message || (payload as any)?.message
        : payload;
      throw new Error(message || `Instagram Graph request failed with ${response.status}`);
    }

    return payload;
  }

  private async exchangeInstagramCode(code: string, redirectUri: string) {
    requireInstagramConfig();

    const form = new URLSearchParams();
    form.set('client_id', config.instagram.clientId);
    form.set('client_secret', config.instagram.clientSecret);
    form.set('grant_type', 'authorization_code');
    form.set('redirect_uri', redirectUri);
    form.set('code', code);

    const response = await fetch(INSTAGRAM_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form,
    });
    const body = await response.json() as any;
    if (!response.ok) throw new Error(body?.error_message || body?.error?.message || 'Failed to exchange Instagram authorization code');

    return parseInstagramTokenPayload(body);
  }

  private async exchangeInstagramLongLivedToken(shortLivedAccessToken: string) {
    requireInstagramConfig();

    const response = await fetch(`${INSTAGRAM_GRAPH_URL}/access_token?` + new URLSearchParams({
      grant_type: 'ig_exchange_token',
      client_secret: config.instagram.clientSecret,
      access_token: shortLivedAccessToken,
    }));
    const body = await response.json() as any;
    if (!response.ok) throw new Error(body?.error?.message || 'Failed to exchange Instagram long-lived token');

    const accessToken = body?.access_token;
    if (!accessToken) throw new Error('Instagram did not return a long-lived access token.');

    return {
      accessToken,
      tokenType: body?.token_type,
      expiresIn: Number(body?.expires_in || 0),
      expiresAt: body?.expires_in
        ? new Date(Date.now() + Number(body.expires_in) * 1000).toISOString()
        : undefined,
    };
  }

  private async getInstagramProfile(accessToken: string) {
    const response = await fetch(`${INSTAGRAM_GRAPH_URL}/${config.instagram.apiVersion}/me?` + new URLSearchParams({
      fields: [
        'id',
        'user_id',
        'username',
        'name',
        'account_type',
        'profile_picture_url',
        'followers_count',
        'follows_count',
        'media_count',
      ].join(','),
      access_token: accessToken,
    }));
    const body = await response.json() as any;
    if (!response.ok) throw new Error(body?.error?.message || 'Failed to fetch Instagram profile');

    const data = Array.isArray(body?.data) ? body.data[0] : body;
    if (!data?.user_id && !data?.id) {
      throw new Error('Instagram profile lookup did not return an account ID.');
    }

    return data;
  }

  private async subscribeInstagramWebhookFields(instagramAccountId: string, accessToken: string) {
    const response = await fetch(
      `${INSTAGRAM_GRAPH_URL}/${config.instagram.apiVersion}/${instagramAccountId}/subscribed_apps?` +
        new URLSearchParams({
          subscribed_fields: config.instagram.subscribedFields.join(','),
          access_token: accessToken,
        }),
      { method: 'POST' },
    );
    const body = await response.json() as any;
    if (!response.ok) throw new Error(body?.error?.message || 'Failed to subscribe Instagram webhook fields');

    return {
      success: Boolean(body?.success),
      fields: config.instagram.subscribedFields,
      response: body,
    };
  }

  async sendMessage(provider: ChannelProvider, input: any) {
    if (provider === 'sms') {
      return this.publishNormalizedOutbound(provider, input, `sms_${Date.now()}`);
    }

    const accessToken = input.pageAccessToken || input.accessToken;
    if (!accessToken) throw new Error('accessToken/pageAccessToken is required');

    const isPrivateReply = provider === 'instagram' && (input.privateReply || input.recipientCommentId);
    const endpoint = input.commentId && !isPrivateReply
      ? `${provider === 'instagram' ? INSTAGRAM_GRAPH_URL : GRAPH_URL}/${provider === 'instagram' ? config.instagram.apiVersion : GRAPH_VERSION}/${input.commentId}/${provider === 'instagram' ? 'replies' : 'comments'}`
      : provider === 'instagram'
        ? `${INSTAGRAM_GRAPH_URL}/${config.instagram.apiVersion}/${input.instagramAccountId || 'me'}/messages`
        : `${GRAPH_URL}/${GRAPH_VERSION}/me/messages`;

    const message = input.message || { text: input.text };
    const payload = input.commentId && !isPrivateReply
      ? { message: input.text, access_token: accessToken }
      : {
          recipient: isPrivateReply
            ? { comment_id: input.recipientCommentId || input.commentId }
            : { id: input.recipientId },
          ...(input.senderAction ? { sender_action: input.senderAction } : { message }),
          access_token: accessToken,
        };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await response.json() as any;
    if (!response.ok) throw new Error(body?.error?.message || `Failed to send ${provider} message`);
    return this.publishNormalizedOutbound(provider, input, body.message_id || body.id);
  }

  async normalizeInbound(provider: ChannelProvider, rawPayload: any) {
    const eventId =
      rawPayload?.entry?.[0]?.messaging?.[0]?.message?.mid ||
      rawPayload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.id ||
      rawPayload?.id ||
      `${provider}_${Date.now()}`;

    const eventMessage = {
      eventId,
      eventType: 'message.inbound',
      provider: provider === 'instagram' || provider === 'facebook' ? 'meta' : provider,
      channel: provider,
      timestamp: new Date().toISOString(),
      rawPayload,
    };

    await this.eventProducer.send('raw-webhook-events', [{
      key: eventId,
      value: JSON.stringify(eventMessage),
    }]);

    return { success: true, eventId };
  }

  private async publishNormalizedOutbound(provider: ChannelProvider, input: any, providerMessageId: string) {
    const eventMessage = {
      eventId: providerMessageId,
      eventType: 'message.status',
      provider: provider === 'instagram' || provider === 'facebook' ? 'meta' : provider,
      channel: provider,
      timestamp: new Date().toISOString(),
      rawPayload: {
        direction: 'outbound',
        provider,
        providerMessageId,
        workspaceId: input.workspaceId,
        recipientId: input.recipientId || input.phone,
        text: input.text,
      },
    };

    await this.eventProducer.send('raw-webhook-events', [{
      key: providerMessageId,
      value: JSON.stringify(eventMessage),
    }]);

    return { success: true, providerMessageId };
  }
}
