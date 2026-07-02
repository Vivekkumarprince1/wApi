import { bspInternalClient } from '../../lib/internal-client';

type InstagramState = {
  workspaceId?: string;
  userId?: string;
  redirectUri?: string;
  returnTo?: string;
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

function unwrapProviderData<T = any>(payload: any): T {
  return payload?.data ?? payload;
}

export class InstagramBusinessService {
  static async generateAuthUrl(params: {
    workspaceId: string;
    userId?: string;
    redirectUri: string;
    returnTo?: string;
    forceReauth?: boolean;
  }) {
    const response = await bspInternalClient.post('/internal/v1/bsp/channels/instagram/oauth-url', params);
    return unwrapProviderData<{
      url: string;
      scopes: string[];
      subscribedFields: string[];
    }>(response.data);
  }

  static parseState(rawState: unknown): InstagramState {
    if (typeof rawState !== 'string' || !rawState) return {};
    try {
      return JSON.parse(Buffer.from(rawState, 'base64url').toString('utf8'));
    } catch {
      return {};
    }
  }

  static async completeOAuth(code: string, redirectUri: string, context: { workspaceId?: string; userId?: string } = {}) {
    const response = await bspInternalClient.post('/internal/v1/bsp/channels/instagram/complete-oauth', {
      code,
      redirectUri,
      workspaceId: context.workspaceId,
      userId: context.userId,
    });
    return unwrapProviderData<{
      instagramAccountId: string;
      appScopedUserId?: string;
      permissions: string[];
      requestedScopes: string[];
      subscribedFields: string[];
      profile: any;
      longLivedToken: {
        accessToken: string;
        tokenType?: string;
        expiresIn?: number;
        expiresAt?: string;
      };
      webhookSubscription: {
        success: boolean;
        fields: string[];
        response?: any;
        error?: string;
        code?: string | number;
      };
    }>(response.data);
  }

  static async refreshLongLivedToken(accessToken: string) {
    const response = await bspInternalClient.post('/internal/v1/bsp/channels/instagram/refresh-token', {
      accessToken,
    });
    const token = unwrapProviderData<{
      accessToken: string;
      tokenType?: string;
      expiresIn?: number;
      expiresAt?: string;
    }>(response.data);

    return {
      ...token,
      expiresAt: token.expiresAt ? new Date(token.expiresAt) : undefined,
    };
  }

  static async graphRequest(request: InstagramGraphRequest) {
    const response = await bspInternalClient.post('/internal/v1/bsp/channels/instagram/graph', request);
    return unwrapProviderData(response.data);
  }

  static buildFields(fields?: unknown, fallback?: string[]) {
    if (Array.isArray(fields)) return fields.filter(Boolean).join(',');
    if (typeof fields === 'string' && fields.trim()) return fields;
    return fallback?.join(',');
  }
}
