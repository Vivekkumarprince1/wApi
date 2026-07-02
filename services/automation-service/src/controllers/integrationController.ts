import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Integration } from '../models';
import { GoogleSheetsService } from '../services/integrations/google-sheets-service';
import { PetpoojaService } from '../services/integrations/petpooja-service';
import { InstagramBusinessService } from '../services/integrations/instagram-business-service';
import { MetaAdsService } from '../services/integrations/meta-ads-service';
import mongoose from 'mongoose';

function getApiOrigin(req: AuthRequest) {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0];
  const proto = forwardedProto || req.protocol;
  return `${proto}://${req.get('host')}`;
}

function getCustomerPortalOrigin(req: AuthRequest) {
  return (
    process.env.CUSTOMER_PORTAL_URL ||
    process.env.FRONTEND_URL ||
    process.env.APP_URL ||
    (typeof req.headers.origin === 'string' ? req.headers.origin : '') ||
    (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : getApiOrigin(req))
  ).replace(/\/$/, '');
}

function getReturnTo(req: AuthRequest) {
  const origin = getCustomerPortalOrigin(req);
  return `${origin}/integrations?google=connected`;
}

function getInstagramReturnTo(req: AuthRequest, status = 'connected') {
  const origin = getCustomerPortalOrigin(req);
  return `${origin}/integrations?instagram=${status}`;
}

function getInstagramRedirectUri(req: AuthRequest) {
  return process.env.INSTAGRAM_REDIRECT_URI || `${getApiOrigin(req)}/api/v1/integrations/instagram/callback`;
}

function getMetaAdsReturnTo(req: AuthRequest, status = 'connected') {
  const origin = getCustomerPortalOrigin(req);
  return `${origin}/integrations?meta_ads=${status}`;
}

function getMetaAdsRedirectUri(req: AuthRequest) {
  return process.env.META_ADS_REDIRECT_URI || `${getApiOrigin(req)}/api/v1/integrations/meta-ads/callback`;
}

function sendMetaAdsError(res: Response, err: any) {
  const message = err?.response?.data?.error?.message || err?.message || 'Meta Ads request failed';
  const notConfigured = message.includes('META_ADS_CLIENT_ID') || message.includes('META_ADS_CLIENT_SECRET') || message.includes('not configured');
  return res.status(notConfigured ? 409 : 500).json({
    success: false,
    code: notConfigured ? 'META_ADS_NOT_CONFIGURED' : 'META_ADS_ERROR',
    message,
  });
}

function sendInstagramError(res: Response, err: any) {
  const providerError = err?.response?.data?.error;
  const providerDetails = providerError?.details;
  const message = providerError?.message || err?.response?.data?.message || err?.message || 'Instagram request failed';
  const notConfigured =
    providerDetails?.code === 'INSTAGRAM_PROVIDER_NOT_CONFIGURED' ||
    message.includes('INSTAGRAM_CLIENT_ID') ||
    message.includes('INSTAGRAM_CLIENT_SECRET') ||
    message.includes('not configured');
  const statusCode = notConfigured ? 503 : Number(providerError?.statusCode || err?.response?.status || 500);

  return res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
    success: false,
    code: notConfigured ? 'INSTAGRAM_PROVIDER_NOT_CONFIGURED' : 'INSTAGRAM_ERROR',
    message,
  });
}

async function getMetaAdsTokenForWorkspace(workspaceId: any) {
  const integration = await (Integration as any).findOne({
    workspace: workspaceId,
    type: 'meta_ads'
  }).select('+config');

  if (!integration || integration.status !== 'connected') {
    const error = new Error('Meta Ads is not connected.');
    (error as any).statusCode = 404;
    throw error;
  }

  const storedConfig = integration.getDecryptedConfig?.() || {};
  const accessToken = storedConfig?.tokens?.accessToken;
  if (!accessToken) {
    const error = new Error('Meta Ads token is missing. Reconnect Meta Ads.');
    (error as any).statusCode = 400;
    throw error;
  }

  return { integration, storedConfig, accessToken };
}

async function getInstagramTokenForWorkspace(workspaceId: any) {
  const integration = await (Integration as any).findOne({
    workspace: workspaceId,
    type: 'instagram'
  }).select('+config');

  if (!integration || !['connected', 'pending'].includes(integration.status)) {
    const error = new Error('Instagram is not connected.');
    (error as any).statusCode = 404;
    throw error;
  }

  const storedConfig = integration.getDecryptedConfig?.() || {};
  const accessToken = storedConfig?.tokens?.accessToken;
  if (!accessToken) {
    const error = new Error('Instagram token is missing. Reconnect Instagram.');
    (error as any).statusCode = 400;
    throw error;
  }

  const instagramAccountId = storedConfig?.instagramAccountId || integration.configMetadata?.instagramAccountId;
  if (!instagramAccountId) {
    const error = new Error('Instagram account id is missing. Reconnect Instagram.');
    (error as any).statusCode = 400;
    throw error;
  }

  return { integration, storedConfig, accessToken, instagramAccountId };
}

function getWorkspaceId(req: AuthRequest) {
  return req.workspace?.id || req.workspace?._id;
}

function asFields(value: unknown, fallback: string[]) {
  return InstagramBusinessService.buildFields(value, fallback);
}

function paginationQuery(query: any) {
  return {
    limit: query.limit,
    after: query.after,
    before: query.before,
    since: query.since,
    until: query.until,
  };
}

function truthyBoolean(value: any) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  return undefined;
}

function safeInstagramUsername(username: unknown) {
  const value = String(username || '').replace(/^@/, '').trim();
  if (!/^[A-Za-z0-9._]{1,30}$/.test(value)) {
    const error = new Error('A valid Instagram username is required.');
    (error as any).statusCode = 400;
    throw error;
  }
  return value;
}

function routeParam(value: unknown) {
  return Array.isArray(value) ? String(value[0] || '') : String(value || '');
}

async function callInstagramForWorkspace(req: AuthRequest, request: {
  method?: 'GET' | 'POST' | 'DELETE';
  path: string;
  query?: Record<string, any>;
  body?: Record<string, any>;
  graphHost?: 'instagram' | 'facebook';
}) {
  const workspaceId = getWorkspaceId(req);
  const { accessToken, instagramAccountId, integration } = await getInstagramTokenForWorkspace(workspaceId);
  const path = request.path.replace(/\{ig-user-id\}/g, String(instagramAccountId));
  const data = await InstagramBusinessService.graphRequest({
    accessToken,
    ...request,
    path,
  });

  return { data, instagramAccountId, integration };
}

export const integrationController = {
  /**
   * List all integrations
   */
  async listIntegrations(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?.id || req.workspace?._id;
      const integrations = await (Integration as any).find({ workspace: workspaceId }).select('+config');
      res.json({
        success: true,
        integrations: integrations.map((integration: any) =>
          integration.toSafeJSON ? integration.toSafeJSON() : integration
        )
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: "Server Error" });
    }
  },

  /**
   * Connect/create integration
   */
  async connect(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?.id || req.workspace?._id;
      const type = req.params.type || req.body.type;
      const { config, isActive } = req.body;
      
      let integration = await (Integration as any).findOne({ workspace: workspaceId, type }).select('+config');
      if (!integration) {
        integration = new (Integration as any)({
          workspace: workspaceId,
          type,
          name: type === 'google_sheets' ? 'Google Sheets' : type === 'petpooja' ? 'Petpooja POS' : type,
          status: 'connected',
          createdBy: req.user?._id || req.user?.id
        });
      }

      if (config) {
        (integration as any).setEncryptedConfig(config);
      }
      integration.status = 'connected';
      integration.updatedBy = req.user?._id || req.user?.id;
      await integration.save();

      res.json({ success: true, integration });
    } catch (err: any) {
      res.status(500).json({ success: false, message: "Server Error" });
    }
  },

  /**
   * Disconnect/remove integration
   */
  async disconnect(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?.id || req.workspace?._id;
      const id = req.params.id as string;
      const query: any = { workspace: workspaceId, $or: [{ type: id }] };
      if (mongoose.Types.ObjectId.isValid(id)) {
        query.$or.push({ _id: id });
      }

      await (Integration as any).findOneAndDelete(query);
      res.json({ success: true, message: "Integration removed" });
    } catch (err: any) {
      res.status(500).json({ success: false, message: "Server Error" });
    }
  },

  async syncIntegration(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?.id || req.workspace?._id;
      const { type } = req.params;
      let syncResult: any = null;

      if (type === 'google_sheets') {
        syncResult = await GoogleSheetsService.syncRows(String(workspaceId));
      } else if (type === 'petpooja') {
        syncResult = await PetpoojaService.syncOrders(String(workspaceId));
      } else {
        const integration = await (Integration as any).findOne({ workspace: workspaceId, type }).select('+config');
        if (integration?.markSynced) {
          await integration.markSynced(0);
          syncResult = integration.toSafeJSON?.() || integration;
        }
      }

      res.json({
        success: true,
        message: `${type} sync completed`,
        data: syncResult
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Google Sheets - List Spreadsheets
   */
  async listGoogleSpreadsheets(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?.id || req.workspace?._id;
      const integration = await (Integration as any).findOne({ 
        workspace: workspaceId, 
        type: 'google_sheets' 
      }).select('+config');

      if (!integration) return res.json({ files: [] });

      const files = await GoogleSheetsService.listSpreadsheets(integration);
      res.json({ files });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  },

  async getGoogleStatus(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?.id || req.workspace?._id;
      const integration = await (Integration as any).findOne({
        workspace: workspaceId,
        type: 'google_sheets'
      });

      res.json({
        connected: integration?.status === 'connected',
        status: integration?.status || 'disconnected',
        integration: integration ? ((integration as any).toSafeJSON ? (integration as any).toSafeJSON() : integration) : null
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  },

  async getGoogleConfig(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?.id || req.workspace?._id;
      const integration = await (Integration as any).findOne({
        workspace: workspaceId,
        type: 'google_sheets'
      }).select('+config');

      res.json({
        success: true,
        config: integration?.configMetadata || {},
        connected: integration?.status === 'connected'
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  },

  async saveGoogleConfig(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?.id || req.workspace?._id;
      let integration = await (Integration as any).findOne({
        workspace: workspaceId,
        type: 'google_sheets'
      }).select('+config');

      if (!integration) {
        integration = new (Integration as any)({
          workspace: workspaceId,
          type: 'google_sheets',
          name: 'Google Sheets',
          status: 'pending',
          syncDirection: 'pull',
          syncInterval: 15,
          createdBy: req.user?._id || req.user?.id
        });
        (integration as any).setEncryptedConfig({});
      }

      const { spreadsheetId, sheetName, syncExisting = false } = req.body || {};
      if (!spreadsheetId || !sheetName) {
        return res.status(400).json({ message: 'Spreadsheet and sheet are required' });
      }

      const columns = await GoogleSheetsService.getColumns(String(workspaceId), spreadsheetId, sheetName);
      const rows = await GoogleSheetsService.fetchAllRows(String(workspaceId), spreadsheetId, sheetName);
      const currentLastRow = rows.length ? rows[rows.length - 1].__rowNumber : 1;

      integration.status = 'connected';
      integration.configMetadata = {
        ...(integration.configMetadata || {}),
        spreadsheetId,
        sheetName,
        columns,
        lastProcessedRow: syncExisting ? 1 : currentLastRow,
        syncExisting: Boolean(syncExisting),
        configuredAt: new Date()
      };
      integration.updatedBy = req.user?._id || req.user?.id;
      await integration.save();

      res.json({ success: true, config: integration.configMetadata });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  },

  async listGoogleSheets(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?.id || req.workspace?._id;
      const spreadsheetId = (req.params.id as string) || (req.query.spreadsheetId as string);
      if (!spreadsheetId) return res.status(400).json({ message: 'Spreadsheet ID is required' });

      const sheets = await GoogleSheetsService.listSheets(String(workspaceId), spreadsheetId);
      res.json({ sheets });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  },

  async listGoogleColumns(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?.id || req.workspace?._id;
      const columns = await GoogleSheetsService.getColumns(
        workspaceId.toString(),
        req.params.id as string,
        (req.query.sheetName as string) || ''
      ).catch(() => []);


      res.json({ columns });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  },

  async googleCallback(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?.id || req.workspace?._id;
      const { code, state } = req.query;
      if (!code) return res.status(400).json({ message: 'Missing Google authorization code' });

      const parsedState = GoogleSheetsService.parseState(state);
      if (parsedState.workspaceId && String(parsedState.workspaceId) !== String(workspaceId)) {
        return res.status(403).json({ message: 'Google authorization state does not match this workspace' });
      }

      const redirectUri = parsedState.redirectUri || process.env.GOOGLE_REDIRECT_URI || `${getApiOrigin(req)}/api/v1/integrations/google/callback`;
      const tokens = await GoogleSheetsService.exchangeCode(String(code), redirectUri);

      let integration = await (Integration as any).findOne({
        workspace: workspaceId,
        type: 'google_sheets'
      }).select('+config');

      if (!integration) {
        integration = new (Integration as any)({
          workspace: workspaceId,
          type: 'google_sheets',
          name: 'Google Sheets',
          syncDirection: 'pull',
          syncInterval: 15,
          createdBy: req.user?._id || req.user?.id
        });
      }

      integration.status = 'connected';
      integration.configMetadata = {
        ...(integration.configMetadata || {}),
        connectedAt: new Date(),
        googleScope: tokens.scope,
        tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined
      };
      integration.credentials = {
        isExpiring: Boolean(tokens.expiry_date),
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        needsReauth: !tokens.refresh_token,
      };
      (integration as any).setEncryptedConfig({ tokens, connectedAt: new Date().toISOString() });
      await integration.save();

      res.redirect(parsedState.returnTo || getReturnTo(req));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  },

  /**
   * Google Auth URL
   */
  async getGoogleAuthUrl(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?.id || req.workspace?._id;
      const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${getApiOrigin(req)}/api/v1/integrations/google/callback`;
      const url = GoogleSheetsService.generateAuthUrl({
        workspaceId: String(workspaceId),
        userId: req.user?._id || req.user?.id,
        redirectUri,
        returnTo: getReturnTo(req),
      });

      res.json({ url });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  },

  async getInstagramStatus(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?.id || req.workspace?._id;
      const integration = await (Integration as any).findOne({
        workspace: workspaceId,
        type: 'instagram'
      });

      res.json({
        connected: integration?.status === 'connected',
        status: integration?.status || 'disconnected',
        integration: integration ? ((integration as any).toSafeJSON ? (integration as any).toSafeJSON() : integration) : null,
        billing: {
          planSlug: process.env.INSTAGRAM_ADDON_PLAN_SLUG || null,
          pricePaise: Number(process.env.INSTAGRAM_ADDON_PRICE_PAISE || 0),
          currency: process.env.INSTAGRAM_ADDON_CURRENCY || 'INR',
        }
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  },

  async getInstagramAuthUrl(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?.id || req.workspace?._id;
      const redirectUri = getInstagramRedirectUri(req);
      const auth = await InstagramBusinessService.generateAuthUrl({
        workspaceId: String(workspaceId),
        userId: req.user?._id || req.user?.id,
        redirectUri,
        returnTo: getInstagramReturnTo(req),
        forceReauth: req.query.force === '1',
      });

      res.json({
        url: auth.url,
        scopes: auth.scopes,
        subscribedFields: auth.subscribedFields,
      });
    } catch (err: any) {
      return sendInstagramError(res, err);
    }
  },

  async instagramCallback(req: AuthRequest, res: Response) {
    try {
      const { code, state, error, error_description } = req.query;
      const parsedState = InstagramBusinessService.parseState(state);
      const returnTo = parsedState.returnTo || getInstagramReturnTo(req);
      const workspaceId = req.workspace?.id || req.workspace?._id || parsedState.workspaceId;
      const userId = req.user?._id || req.user?.id || parsedState.userId;

      if (error) {
        return res.redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}error=${encodeURIComponent(String(error_description || error))}`);
      }

      if (!code) return res.status(400).json({ message: 'Missing Instagram authorization code' });
      if (!workspaceId) return res.status(400).json({ message: 'Missing Instagram authorization state' });
      if (parsedState.workspaceId && String(parsedState.workspaceId) !== String(workspaceId)) {
        return res.status(403).json({ message: 'Instagram authorization state does not match this workspace' });
      }

      const redirectUri = parsedState.redirectUri || getInstagramRedirectUri(req);
      const completed = await InstagramBusinessService.completeOAuth(String(code).replace(/#_$/, ''), redirectUri, {
        workspaceId: String(workspaceId),
        userId,
      });
      const longLivedToken = completed.longLivedToken;
      const profile = completed.profile || {};
      const instagramAccountId = completed.instagramAccountId;
      const webhookSubscription = completed.webhookSubscription || { success: false, fields: completed.subscribedFields || [] };

      let integration = await (Integration as any).findOne({
        workspace: workspaceId,
        type: 'instagram'
      }).select('+config');

      if (!integration) {
        integration = new (Integration as any)({
          workspace: workspaceId,
          type: 'instagram',
          name: 'Instagram Business',
          syncDirection: 'bidirectional',
          syncInterval: 0,
          createdBy: userId
        });
      }

      const tokenExpiresAt = longLivedToken.expiresAt ? new Date(longLivedToken.expiresAt) : undefined;
      integration.status = webhookSubscription.success ? 'connected' : 'pending';
      integration.configMetadata = {
        ...(integration.configMetadata || {}),
        connectedAt: new Date(),
        instagramAccountId,
        appScopedUserId: completed.appScopedUserId,
        username: profile.username,
        displayName: profile.name,
        accountType: profile.account_type,
        profilePictureUrl: profile.profile_picture_url,
        followersCount: profile.followers_count,
        followsCount: profile.follows_count,
        mediaCount: profile.media_count,
        grantedPermissions: completed.permissions,
        requestedScopes: completed.requestedScopes,
        subscribedFields: completed.subscribedFields,
        tokenExpiresAt,
        webhookSubscription,
      };
      integration.credentials = {
        isExpiring: Boolean(tokenExpiresAt),
        expiresAt: tokenExpiresAt,
        needsReauth: false,
        reauthUrl: undefined,
      };
      integration.updatedBy = userId;

      if (!webhookSubscription.success) {
        integration.lastError = {
          message: webhookSubscription.error || 'Instagram OAuth completed, but webhook subscription is not active.',
          code: 'WEBHOOK_SUBSCRIPTION_PENDING',
          timestamp: new Date(),
          retryCount: integration.lastError?.retryCount || 0,
        };
      } else {
        integration.lastError = undefined;
      }

      (integration as any).setEncryptedConfig({
        tokens: {
          accessToken: longLivedToken.accessToken,
          tokenType: longLivedToken.tokenType,
          expiresIn: longLivedToken.expiresIn,
          expiresAt: tokenExpiresAt?.toISOString(),
        },
        instagramAccountId,
        permissions: completed.permissions,
        connectedAt: new Date().toISOString(),
      });
      await integration.save();

      const status = webhookSubscription.success ? 'connected' : 'pending';
      res.redirect(`${returnTo.replace(/instagram=connected/g, `instagram=${status}`)}`);
    } catch (err: any) {
      res.status(500).json({ message: err?.response?.data?.error?.message || err.message });
    }
  },

  async refreshInstagramToken(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?.id || req.workspace?._id;
      const integration = await (Integration as any).findOne({
        workspace: workspaceId,
        type: 'instagram'
      }).select('+config');

      if (!integration) return res.status(404).json({ message: 'Instagram is not connected.' });

      const storedConfig = integration.getDecryptedConfig?.() || {};
      const accessToken = storedConfig?.tokens?.accessToken;
      if (!accessToken) return res.status(400).json({ message: 'Instagram token is missing. Reconnect Instagram.' });

      const refreshedToken = await InstagramBusinessService.refreshLongLivedToken(accessToken);
      const metadata = integration.configMetadata || {};

      integration.configMetadata = {
        ...metadata,
        tokenExpiresAt: refreshedToken.expiresAt,
        tokenRefreshedAt: new Date(),
      };
      integration.credentials = {
        isExpiring: Boolean(refreshedToken.expiresAt),
        expiresAt: refreshedToken.expiresAt,
        needsReauth: false,
      };
      (integration as any).setEncryptedConfig({
        ...storedConfig,
        tokens: {
          ...(storedConfig.tokens || {}),
          accessToken: refreshedToken.accessToken,
          tokenType: refreshedToken.tokenType,
          expiresIn: refreshedToken.expiresIn,
          expiresAt: refreshedToken.expiresAt?.toISOString(),
        },
      });
      await integration.markSynced(0);

      res.json({ success: true, integration: integration.toSafeJSON?.() || integration });
    } catch (err: any) {
      res.status(500).json({ message: err?.response?.data?.error?.message || err.message });
    }
  },

  async instagramGraph(req: AuthRequest, res: Response) {
    try {
      const body = req.body || {};
      const result = await callInstagramForWorkspace(req, {
        method: body.method || 'GET',
        path: body.path,
        query: body.query,
        body: body.body,
        graphHost: body.graphHost,
      });
      res.json({ success: true, data: result.data, instagramAccountId: result.instagramAccountId });
    } catch (err: any) {
      return sendInstagramError(res, err);
    }
  },

  async getInstagramProfile(req: AuthRequest, res: Response) {
    try {
      const { data, instagramAccountId } = await callInstagramForWorkspace(req, {
        method: 'GET',
        path: String(req.query.instagramAccountId || '{ig-user-id}'),
        query: {
          fields: asFields(req.query.fields, [
            'id',
            'user_id',
            'username',
            'name',
            'account_type',
            'profile_picture_url',
            'followers_count',
            'follows_count',
            'media_count',
            'biography',
            'website',
          ]),
        },
      });
      res.json({ success: true, data, instagramAccountId });
    } catch (err: any) {
      return sendInstagramError(res, err);
    }
  },

  async listInstagramMedia(req: AuthRequest, res: Response) {
    try {
      const { data } = await callInstagramForWorkspace(req, {
        method: 'GET',
        path: '{ig-user-id}/media',
        query: {
          ...paginationQuery(req.query),
          fields: asFields(req.query.fields, [
            'id',
            'caption',
            'media_type',
            'media_product_type',
            'media_url',
            'permalink',
            'thumbnail_url',
            'timestamp',
            'username',
            'comments_count',
            'like_count',
          ]),
        },
      });
      res.json({ success: true, data });
    } catch (err: any) {
      return sendInstagramError(res, err);
    }
  },

  async createInstagramMediaContainer(req: AuthRequest, res: Response) {
    try {
      const { data } = await callInstagramForWorkspace(req, {
        method: 'POST',
        path: '{ig-user-id}/media',
        body: req.body || {},
      });
      res.json({ success: true, data });
    } catch (err: any) {
      return sendInstagramError(res, err);
    }
  },

  async publishInstagramMedia(req: AuthRequest, res: Response) {
    try {
      const creationId = req.body?.creation_id || req.body?.creationId;
      const { data } = await callInstagramForWorkspace(req, {
        method: 'POST',
        path: '{ig-user-id}/media_publish',
        body: { creation_id: creationId },
      });
      res.json({ success: true, data });
    } catch (err: any) {
      return sendInstagramError(res, err);
    }
  },

  async getInstagramPublishingLimit(req: AuthRequest, res: Response) {
    try {
      const { data } = await callInstagramForWorkspace(req, {
        method: 'GET',
        path: '{ig-user-id}/content_publishing_limit',
        query: {
          since: req.query.since,
          fields: asFields(req.query.fields, ['quota_usage', 'rate_limit_settings']),
        },
      });
      res.json({ success: true, data });
    } catch (err: any) {
      return sendInstagramError(res, err);
    }
  },

  async getInstagramMedia(req: AuthRequest, res: Response) {
    try {
      const { data } = await callInstagramForWorkspace(req, {
        method: 'GET',
        path: routeParam(req.params.mediaId),
        query: {
          fields: asFields(req.query.fields, [
            'id',
            'caption',
            'media_type',
            'media_product_type',
            'media_url',
            'permalink',
            'thumbnail_url',
            'timestamp',
            'username',
            'comments_count',
            'like_count',
            'owner',
          ]),
        },
      });
      res.json({ success: true, data });
    } catch (err: any) {
      return sendInstagramError(res, err);
    }
  },

  async updateInstagramMediaSettings(req: AuthRequest, res: Response) {
    try {
      const { data } = await callInstagramForWorkspace(req, {
        method: 'POST',
        path: routeParam(req.params.mediaId),
        body: {
          ...req.body,
          comment_enabled: req.body?.comment_enabled ?? req.body?.commentEnabled,
        },
      });
      res.json({ success: true, data });
    } catch (err: any) {
      return sendInstagramError(res, err);
    }
  },

  async deleteInstagramMedia(req: AuthRequest, res: Response) {
    try {
      const { data } = await callInstagramForWorkspace(req, {
        method: 'DELETE',
        path: routeParam(req.params.mediaId),
      });
      res.json({ success: true, data });
    } catch (err: any) {
      return sendInstagramError(res, err);
    }
  },

  async getInstagramMediaChildren(req: AuthRequest, res: Response) {
    try {
      const { data } = await callInstagramForWorkspace(req, {
        method: 'GET',
        path: `${req.params.mediaId}/children`,
        query: {
          ...paginationQuery(req.query),
          fields: asFields(req.query.fields, ['id', 'media_type', 'media_url', 'permalink', 'timestamp']),
        },
      });
      res.json({ success: true, data });
    } catch (err: any) {
      return sendInstagramError(res, err);
    }
  },

  async getInstagramMediaCollaborators(req: AuthRequest, res: Response) {
    try {
      const { data } = await callInstagramForWorkspace(req, {
        method: 'GET',
        path: `${req.params.mediaId}/collaborators`,
        query: paginationQuery(req.query),
      });
      res.json({ success: true, data });
    } catch (err: any) {
      return sendInstagramError(res, err);
    }
  },

  async getInstagramMediaInsights(req: AuthRequest, res: Response) {
    try {
      const { data } = await callInstagramForWorkspace(req, {
        method: 'GET',
        path: `${req.params.mediaId}/insights`,
        query: {
          metric: req.query.metric,
          period: req.query.period,
          breakdown: req.query.breakdown,
        },
      });
      res.json({ success: true, data });
    } catch (err: any) {
      return sendInstagramError(res, err);
    }
  },

  async listInstagramProductTags(req: AuthRequest, res: Response) {
    try {
      const { data } = await callInstagramForWorkspace(req, {
        method: 'GET',
        path: `${req.params.mediaId}/product_tags`,
        query: paginationQuery(req.query),
      });
      res.json({ success: true, data });
    } catch (err: any) {
      return sendInstagramError(res, err);
    }
  },

  async updateInstagramProductTags(req: AuthRequest, res: Response) {
    try {
      const { data } = await callInstagramForWorkspace(req, {
        method: 'POST',
        path: `${req.params.mediaId}/product_tags`,
        body: {
          updated_tags: req.body?.updated_tags || req.body?.updatedTags || req.body?.tags,
        },
      });
      res.json({ success: true, data });
    } catch (err: any) {
      return sendInstagramError(res, err);
    }
  },

  async listInstagramComments(req: AuthRequest, res: Response) {
    try {
      const { data } = await callInstagramForWorkspace(req, {
        method: 'GET',
        path: `${req.params.mediaId}/comments`,
        query: {
          ...paginationQuery(req.query),
          fields: asFields(req.query.fields, [
            'id',
            'text',
            'timestamp',
            'username',
            'from',
            'hidden',
            'like_count',
            'replies',
          ]),
        },
      });
      res.json({ success: true, data });
    } catch (err: any) {
      return sendInstagramError(res, err);
    }
  },

  async createInstagramComment(req: AuthRequest, res: Response) {
    try {
      const { data } = await callInstagramForWorkspace(req, {
        method: 'POST',
        path: `${req.params.mediaId}/comments`,
        body: { message: req.body?.message || req.body?.text },
      });
      res.json({ success: true, data });
    } catch (err: any) {
      return sendInstagramError(res, err);
    }
  },

  async getInstagramComment(req: AuthRequest, res: Response) {
    try {
      const { data } = await callInstagramForWorkspace(req, {
        method: 'GET',
        path: routeParam(req.params.commentId),
        query: {
          fields: asFields(req.query.fields, ['id', 'text', 'timestamp', 'username', 'from', 'hidden', 'like_count', 'media', 'replies']),
        },
      });
      res.json({ success: true, data });
    } catch (err: any) {
      return sendInstagramError(res, err);
    }
  },

  async replyToInstagramComment(req: AuthRequest, res: Response) {
    try {
      const { data } = await callInstagramForWorkspace(req, {
        method: 'POST',
        path: `${req.params.commentId}/replies`,
        body: { message: req.body?.message || req.body?.text },
      });
      res.json({ success: true, data });
    } catch (err: any) {
      return sendInstagramError(res, err);
    }
  },

  async updateInstagramCommentVisibility(req: AuthRequest, res: Response) {
    try {
      const hidden = req.body?.hidden ?? truthyBoolean(req.query.hidden);
      const { data } = await callInstagramForWorkspace(req, {
        method: 'POST',
        path: routeParam(req.params.commentId),
        body: { hidden },
      });
      res.json({ success: true, data });
    } catch (err: any) {
      return sendInstagramError(res, err);
    }
  },

  async deleteInstagramComment(req: AuthRequest, res: Response) {
    try {
      const { data } = await callInstagramForWorkspace(req, {
        method: 'DELETE',
        path: routeParam(req.params.commentId),
      });
      res.json({ success: true, data });
    } catch (err: any) {
      return sendInstagramError(res, err);
    }
  },

  async sendInstagramPrivateReply(req: AuthRequest, res: Response) {
    try {
      const { data } = await callInstagramForWorkspace(req, {
        method: 'POST',
        path: '{ig-user-id}/messages',
        body: {
          recipient: { comment_id: req.body?.commentId || req.body?.comment_id },
          message: req.body?.message || { text: req.body?.text },
        },
      });
      res.json({ success: true, data });
    } catch (err: any) {
      return sendInstagramError(res, err);
    }
  },

  async listInstagramConversations(req: AuthRequest, res: Response) {
    try {
      const { data } = await callInstagramForWorkspace(req, {
        method: 'GET',
        path: '{ig-user-id}/conversations',
        query: {
          ...paginationQuery(req.query),
          platform: req.query.platform || 'instagram',
          fields: asFields(req.query.fields, ['id', 'updated_time', 'messages.limit(1){id,message,from,to,created_time}']),
        },
      });
      res.json({ success: true, data });
    } catch (err: any) {
      return sendInstagramError(res, err);
    }
  },

  async listInstagramConversationMessages(req: AuthRequest, res: Response) {
    try {
      const { data } = await callInstagramForWorkspace(req, {
        method: 'GET',
        path: `${req.params.conversationId}/messages`,
        query: {
          ...paginationQuery(req.query),
          fields: asFields(req.query.fields, ['id', 'message', 'from', 'to', 'created_time', 'attachments']),
        },
      });
      res.json({ success: true, data });
    } catch (err: any) {
      return sendInstagramError(res, err);
    }
  },

  async getInstagramMessage(req: AuthRequest, res: Response) {
    try {
      const { data } = await callInstagramForWorkspace(req, {
        method: 'GET',
        path: routeParam(req.params.messageId),
        query: {
          fields: asFields(req.query.fields, ['id', 'message', 'from', 'to', 'created_time', 'attachments', 'shares']),
        },
      });
      res.json({ success: true, data });
    } catch (err: any) {
      return sendInstagramError(res, err);
    }
  },

  async sendInstagramMessage(req: AuthRequest, res: Response) {
    try {
      const recipient = req.body?.recipient || { id: req.body?.recipientId || req.body?.instagramUserId };
      const message = req.body?.message || { text: req.body?.text };
      const { data } = await callInstagramForWorkspace(req, {
        method: 'POST',
        path: '{ig-user-id}/messages',
        body: req.body?.senderAction
          ? { recipient, sender_action: req.body.senderAction }
          : { recipient, message, messaging_type: req.body?.messagingType },
      });
      res.json({ success: true, data });
    } catch (err: any) {
      return sendInstagramError(res, err);
    }
  },

  async getInstagramUserProfile(req: AuthRequest, res: Response) {
    try {
      const { data } = await callInstagramForWorkspace(req, {
        method: 'GET',
        path: routeParam(req.params.userId),
        query: {
          fields: asFields(req.query.fields, ['id', 'name', 'username', 'profile_pic']),
        },
      });
      res.json({ success: true, data });
    } catch (err: any) {
      return sendInstagramError(res, err);
    }
  },

  async getInstagramAccountInsights(req: AuthRequest, res: Response) {
    try {
      const { data } = await callInstagramForWorkspace(req, {
        method: 'GET',
        path: '{ig-user-id}/insights',
        query: {
          metric: req.query.metric,
          period: req.query.period,
          metric_type: req.query.metric_type || req.query.metricType,
          breakdown: req.query.breakdown,
          since: req.query.since,
          until: req.query.until,
        },
      });
      res.json({ success: true, data });
    } catch (err: any) {
      return sendInstagramError(res, err);
    }
  },

  async getInstagramBusinessDiscovery(req: AuthRequest, res: Response) {
    try {
      const username = safeInstagramUsername(req.params.username || req.query.username);
      const fields = asFields(req.query.discoveryFields || req.query.targetFields, [
        'id',
        'username',
        'name',
        'profile_picture_url',
        'followers_count',
        'follows_count',
        'media_count',
        'media.limit(12){id,caption,media_type,media_url,permalink,timestamp,comments_count,like_count}',
      ]);
      const { data } = await callInstagramForWorkspace(req, {
        method: 'GET',
        path: '{ig-user-id}',
        query: {
          fields: `business_discovery.username(${username}){${fields}}`,
        },
      });
      res.json({ success: true, data });
    } catch (err: any) {
      return sendInstagramError(res, err);
    }
  },

  async searchInstagramHashtags(req: AuthRequest, res: Response) {
    try {
      const { instagramAccountId } = await getInstagramTokenForWorkspace(getWorkspaceId(req));
      const { data } = await callInstagramForWorkspace(req, {
        method: 'GET',
        path: 'ig_hashtag_search',
        query: {
          user_id: req.query.user_id || instagramAccountId,
          q: req.query.q || req.query.query,
        },
      });
      res.json({ success: true, data });
    } catch (err: any) {
      return sendInstagramError(res, err);
    }
  },

  async listInstagramHashtagMedia(req: AuthRequest, res: Response) {
    try {
      const requestedEdge = routeParam(req.params.edge);
      if (!['recent-media', 'top-media'].includes(requestedEdge)) {
        return res.status(400).json({ success: false, message: 'Hashtag media edge must be recent-media or top-media.' });
      }
      const edge = requestedEdge === 'top-media' ? 'top_media' : 'recent_media';
      const { instagramAccountId } = await getInstagramTokenForWorkspace(getWorkspaceId(req));
      const { data } = await callInstagramForWorkspace(req, {
        method: 'GET',
        path: `${req.params.hashtagId}/${edge}`,
        query: {
          ...paginationQuery(req.query),
          user_id: req.query.user_id || instagramAccountId,
          fields: asFields(req.query.fields, ['id', 'media_type', 'comments_count', 'like_count', 'permalink']),
        },
      });
      res.json({ success: true, data });
    } catch (err: any) {
      return sendInstagramError(res, err);
    }
  },

  async listRecentlySearchedInstagramHashtags(req: AuthRequest, res: Response) {
    try {
      const { data } = await callInstagramForWorkspace(req, {
        method: 'GET',
        path: '{ig-user-id}/recently_searched_hashtags',
        query: paginationQuery(req.query),
      });
      res.json({ success: true, data });
    } catch (err: any) {
      return sendInstagramError(res, err);
    }
  },

  async listInstagramCatalogs(req: AuthRequest, res: Response) {
    try {
      const { data } = await callInstagramForWorkspace(req, {
        method: 'GET',
        path: '{ig-user-id}/available_catalogs',
        query: {
          ...paginationQuery(req.query),
          fields: asFields(req.query.fields, ['catalog_id', 'catalog_name', 'shop_name', 'product_count']),
        },
      });
      res.json({ success: true, data });
    } catch (err: any) {
      return sendInstagramError(res, err);
    }
  },

  async searchInstagramCatalogProducts(req: AuthRequest, res: Response) {
    try {
      const { data } = await callInstagramForWorkspace(req, {
        method: 'GET',
        path: '{ig-user-id}/catalog_product_search',
        query: {
          ...paginationQuery(req.query),
          catalog_id: req.params.catalogId || req.query.catalog_id || req.query.catalogId,
          q: req.query.q || req.query.query,
        },
      });
      res.json({ success: true, data });
    } catch (err: any) {
      return sendInstagramError(res, err);
    }
  },

  async getInstagramProductAppeal(req: AuthRequest, res: Response) {
    try {
      const { data } = await callInstagramForWorkspace(req, {
        method: 'GET',
        path: '{ig-user-id}/product_appeal',
        query: {
          product_id: req.params.productId || req.query.product_id || req.query.productId,
        },
      });
      res.json({ success: true, data });
    } catch (err: any) {
      return sendInstagramError(res, err);
    }
  },

  async createInstagramProductAppeal(req: AuthRequest, res: Response) {
    try {
      const { data } = await callInstagramForWorkspace(req, {
        method: 'POST',
        path: '{ig-user-id}/product_appeal',
        body: {
          product_id: req.params.productId || req.body?.product_id || req.body?.productId,
          appeal_reason: req.body?.appeal_reason || req.body?.appealReason,
        },
      });
      res.json({ success: true, data });
    } catch (err: any) {
      return sendInstagramError(res, err);
    }
  },

  async listInstagramTags(req: AuthRequest, res: Response) {
    try {
      const { data } = await callInstagramForWorkspace(req, {
        method: 'GET',
        path: '{ig-user-id}/tags',
        query: {
          ...paginationQuery(req.query),
          fields: asFields(req.query.fields, ['id', 'username', 'media_type', 'media_url', 'permalink', 'timestamp']),
        },
      });
      res.json({ success: true, data });
    } catch (err: any) {
      return sendInstagramError(res, err);
    }
  },

  async listInstagramStories(req: AuthRequest, res: Response) {
    try {
      const { data } = await callInstagramForWorkspace(req, {
        method: 'GET',
        path: '{ig-user-id}/stories',
        query: {
          ...paginationQuery(req.query),
          fields: asFields(req.query.fields, ['id', 'media_type', 'media_url', 'permalink', 'timestamp']),
        },
      });
      res.json({ success: true, data });
    } catch (err: any) {
      return sendInstagramError(res, err);
    }
  },

  async listInstagramLiveMedia(req: AuthRequest, res: Response) {
    try {
      const { data } = await callInstagramForWorkspace(req, {
        method: 'GET',
        path: '{ig-user-id}/live_media',
        query: {
          ...paginationQuery(req.query),
          fields: asFields(req.query.fields, ['id', 'media_type', 'media_product_type', 'owner', 'username', 'comments']),
        },
      });
      res.json({ success: true, data });
    } catch (err: any) {
      return sendInstagramError(res, err);
    }
  },

  async getInstagramMentionedComment(req: AuthRequest, res: Response) {
    try {
      const fields = asFields(req.query.fields, ['timestamp', 'like_count', 'text', 'id', 'media{id,media_url}']);
      const { data } = await callInstagramForWorkspace(req, {
        method: 'GET',
        path: '{ig-user-id}',
        query: {
          fields: `mentioned_comment.comment_id(${req.params.commentId}){${fields}}`,
        },
      });
      res.json({ success: true, data });
    } catch (err: any) {
      return sendInstagramError(res, err);
    }
  },

  async getInstagramMentionedMedia(req: AuthRequest, res: Response) {
    try {
      const fields = asFields(req.query.fields, ['caption', 'media_type', 'media_url', 'permalink', 'timestamp']);
      const { data } = await callInstagramForWorkspace(req, {
        method: 'GET',
        path: '{ig-user-id}',
        query: {
          fields: `mentioned_media.media_id(${req.params.mediaId}){${fields}}`,
        },
      });
      res.json({ success: true, data });
    } catch (err: any) {
      return sendInstagramError(res, err);
    }
  },

  async replyToInstagramMention(req: AuthRequest, res: Response) {
    try {
      const { data } = await callInstagramForWorkspace(req, {
        method: 'POST',
        path: '{ig-user-id}/mentions',
        body: {
          media_id: req.body?.media_id || req.body?.mediaId,
          comment_id: req.body?.comment_id || req.body?.commentId,
          message: req.body?.message || req.body?.text,
        },
      });
      res.json({ success: true, data });
    } catch (err: any) {
      return sendInstagramError(res, err);
    }
  },

  async getInstagramOEmbed(req: AuthRequest, res: Response) {
    try {
      const { data } = await callInstagramForWorkspace(req, {
        method: 'GET',
        path: 'instagram_oembed',
        graphHost: 'facebook',
        query: {
          url: req.query.url,
          maxwidth: req.query.maxwidth,
          hidecaption: req.query.hidecaption,
          omitscript: req.query.omitscript,
        },
      });
      res.json({ success: true, data });
    } catch (err: any) {
      return sendInstagramError(res, err);
    }
  },

  async getInstagramMessengerProfile(req: AuthRequest, res: Response) {
    try {
      const { data } = await callInstagramForWorkspace(req, {
        method: 'GET',
        path: '{ig-user-id}/messenger_profile',
        query: {
          fields: asFields(req.query.fields, ['ice_breakers', 'persistent_menu', 'get_started']),
        },
      });
      res.json({ success: true, data });
    } catch (err: any) {
      return sendInstagramError(res, err);
    }
  },

  async updateInstagramMessengerProfile(req: AuthRequest, res: Response) {
    try {
      const { data } = await callInstagramForWorkspace(req, {
        method: 'POST',
        path: '{ig-user-id}/messenger_profile',
        body: req.body || {},
      });
      res.json({ success: true, data });
    } catch (err: any) {
      return sendInstagramError(res, err);
    }
  },

  async getMetaAdsStatus(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?.id || req.workspace?._id;
      const integration = await (Integration as any).findOne({
        workspace: workspaceId,
        type: 'meta_ads'
      });

      const safe = integration ? ((integration as any).toSafeJSON ? (integration as any).toSafeJSON() : integration) : null;
      res.json({
        connected: integration?.status === 'connected',
        configured: Boolean(integration?.configMetadata?.selected?.adAccountId),
        status: integration?.status || 'disconnected',
        integration: safe,
        scopes: MetaAdsService.getScopes(),
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  },

  async getMetaAdsAuthUrl(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?.id || req.workspace?._id;
      const redirectUri = getMetaAdsRedirectUri(req);
      const url = MetaAdsService.generateAuthUrl({
        workspaceId: String(workspaceId),
        userId: req.user?._id || req.user?.id,
        redirectUri,
        returnTo: getMetaAdsReturnTo(req),
        forceReauth: req.query.force === '1',
      });

      res.json({ url, scopes: MetaAdsService.getScopes() });
    } catch (err: any) {
      return sendMetaAdsError(res, err);
    }
  },

  async metaAdsCallback(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?.id || req.workspace?._id;
      const { code, state, error, error_description } = req.query;
      const parsedState = MetaAdsService.parseState(state);
      const returnTo = parsedState.returnTo || getMetaAdsReturnTo(req);

      if (error) {
        return res.redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}error=${encodeURIComponent(String(error_description || error))}`);
      }

      if (!code) return res.status(400).json({ message: 'Missing Meta authorization code' });
      if (parsedState.workspaceId && String(parsedState.workspaceId) !== String(workspaceId)) {
        return res.status(403).json({ message: 'Meta Ads authorization state does not match this workspace' });
      }

      const redirectUri = parsedState.redirectUri || getMetaAdsRedirectUri(req);
      const shortLivedToken = await MetaAdsService.exchangeCode(String(code).replace(/#_$/, ''), redirectUri);
      const longLivedToken = await MetaAdsService.exchangeForLongLivedToken(shortLivedToken.accessToken);
      const discovered = await MetaAdsService.discoverAssets(longLivedToken.accessToken);

      let integration = await (Integration as any).findOne({
        workspace: workspaceId,
        type: 'meta_ads'
      }).select('+config');

      if (!integration) {
        integration = new (Integration as any)({
          workspace: workspaceId,
          type: 'meta_ads',
          name: 'Meta Ads',
          syncDirection: 'pull',
          syncInterval: 60,
          createdBy: req.user?._id || req.user?.id
        });
      }

      const tokenExpiresAt = longLivedToken.expiresAt;
      const existingConfig = integration.getDecryptedConfig?.() || {};
      integration.status = 'connected';
      integration.configMetadata = {
        ...(integration.configMetadata || {}),
        connectedAt: new Date(),
        metaUser: discovered.profile ? {
          id: discovered.profile.id,
          name: discovered.profile.name,
          email: discovered.profile.email,
        } : undefined,
        tokenExpiresAt,
        requestedScopes: MetaAdsService.getScopes(),
        grantedScopes: discovered.debugToken?.scopes || discovered.debugToken?.granular_scopes,
        assets: MetaAdsService.toSafeAssets(discovered),
        selected: integration.configMetadata?.selected || {},
      };
      integration.credentials = {
        isExpiring: Boolean(tokenExpiresAt),
        expiresAt: tokenExpiresAt,
        needsReauth: false,
      };
      integration.updatedBy = req.user?._id || req.user?.id;
      integration.lastError = undefined;
      (integration as any).setEncryptedConfig({
        ...existingConfig,
        tokens: {
          accessToken: longLivedToken.accessToken,
          tokenType: longLivedToken.tokenType,
          expiresIn: longLivedToken.expiresIn,
          expiresAt: tokenExpiresAt?.toISOString(),
        },
        assets: discovered,
        selected: existingConfig.selected || {},
        connectedAt: new Date().toISOString(),
      });
      await integration.save();

      res.redirect(`${returnTo.replace(/meta_ads=connected/g, 'meta_ads=connected')}`);
    } catch (err: any) {
      res.status(500).json({ message: err?.response?.data?.error?.message || err.message });
    }
  },

  async refreshMetaAdsAssets(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?.id || req.workspace?._id;
      const integration = await (Integration as any).findOne({
        workspace: workspaceId,
        type: 'meta_ads'
      }).select('+config');

      if (!integration) return res.status(404).json({ message: 'Meta Ads is not connected.' });
      const storedConfig = integration.getDecryptedConfig?.() || {};
      const accessToken = storedConfig?.tokens?.accessToken;
      if (!accessToken) return res.status(400).json({ message: 'Meta Ads token is missing. Reconnect Meta Ads.' });

      const discovered = await MetaAdsService.discoverAssets(accessToken);
      integration.configMetadata = {
        ...(integration.configMetadata || {}),
        assets: MetaAdsService.toSafeAssets(discovered),
        lastAssetRefreshAt: new Date(),
      };
      (integration as any).setEncryptedConfig({
        ...storedConfig,
        assets: discovered,
      });
      await integration.markSynced(0);

      res.json({ success: true, integration: integration.toSafeJSON?.() || integration });
    } catch (err: any) {
      res.status(500).json({ message: err?.response?.data?.error?.message || err.message });
    }
  },

  async saveMetaAdsConfig(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?.id || req.workspace?._id;
      const integration = await (Integration as any).findOne({
        workspace: workspaceId,
        type: 'meta_ads'
      }).select('+config');

      if (!integration) return res.status(404).json({ message: 'Connect Meta Ads before configuring assets.' });

      const selected = MetaAdsService.normalizeSelectedConfig(req.body || {});
      if (!selected.adAccountId) return res.status(400).json({ message: 'Ad account is required.' });
      if (!selected.pageId) return res.status(400).json({ message: 'Facebook Page is required.' });
      if (!selected.whatsappPhoneNumberId && !selected.whatsappPhoneNumber) {
        return res.status(400).json({ message: 'WhatsApp phone number is required.' });
      }

      const assets = integration.configMetadata?.assets || {};
      const matchingAccount = (assets.adAccounts || []).find((account: any) =>
        account.id === selected.adAccountId || `act_${account.account_id}` === selected.adAccountId
      );
      const matchingPage = (assets.pages || []).find((page: any) => page.id === selected.pageId);
      const matchingPhone = selected.whatsappPhoneNumberId
        ? (assets.whatsappPhoneNumbers || []).find((phone: any) => phone.id === selected.whatsappPhoneNumberId)
        : undefined;
      const matchingCatalog = selected.productCatalogId
        ? (assets.productCatalogs || []).find((catalog: any) => catalog.id === selected.productCatalogId)
        : undefined;
      const matchingProductSet = selected.productSetId
        ? (assets.productSets || []).find((productSet: any) => productSet.id === selected.productSetId)
        : undefined;

      if (selected.productSetId && !selected.productCatalogId) {
        return res.status(400).json({ message: 'Choose a product catalog before choosing a product set.' });
      }
      if (selected.productSetId && matchingProductSet?.productCatalogId && matchingProductSet.productCatalogId !== selected.productCatalogId) {
        return res.status(400).json({ message: 'Selected product set does not belong to the selected catalog.' });
      }

      const storedConfig = integration.getDecryptedConfig?.() || {};
      integration.configMetadata = {
        ...(integration.configMetadata || {}),
        selected: {
          ...selected,
          adAccountName: matchingAccount?.name,
          pageName: matchingPage?.name,
          whatsappDisplayPhoneNumber: matchingPhone?.display_phone_number,
          productCatalogName: matchingCatalog?.name,
          productSetName: matchingProductSet?.name,
          configuredAt: new Date(),
        },
      };
      integration.status = 'connected';
      integration.updatedBy = req.user?._id || req.user?.id;
      (integration as any).setEncryptedConfig({
        ...storedConfig,
        selected,
      });
      await integration.save();

      res.json({ success: true, integration: integration.toSafeJSON?.() || integration });
    } catch (err: any) {
      res.status(400).json({ message: err?.response?.data?.error?.message || err.message });
    }
  },

  async listMetaCatalogProducts(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?.id || req.workspace?._id;
      const catalogId = String(req.params.catalogId || req.query.catalogId || '').trim();
      if (!catalogId) return res.status(400).json({ message: 'Product catalog is required.' });

      const { accessToken } = await getMetaAdsTokenForWorkspace(workspaceId);
      const result = await MetaAdsService.listCatalogProducts(accessToken, catalogId, Number(req.query.limit || 50));
      res.json({ success: true, data: result.data?.data || [], paging: result.data?.paging, metaRequestId: result.metaRequestId });
    } catch (err: any) {
      res.status(err?.statusCode || 500).json({ message: err?.response?.data?.error?.message || err.message });
    }
  },

  async syncMetaCatalogProduct(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?.id || req.workspace?._id;
      const catalogId = String(req.params.catalogId || req.body?.catalogId || '').trim();
      if (!catalogId) return res.status(400).json({ message: 'Product catalog is required.' });

      const { accessToken } = await getMetaAdsTokenForWorkspace(workspaceId);
      const result = await MetaAdsService.syncCatalogProduct(accessToken, catalogId, req.body?.product || req.body || {});
      res.json({
        success: true,
        action: result.action,
        retailerId: result.retailerId,
        data: result.data,
        metaRequestId: result.metaRequestId,
      });
    } catch (err: any) {
      res.status(err?.statusCode || 400).json({
        message: err?.response?.data?.error?.message || err.message,
        error: err?.response?.data?.error,
      });
    }
  },

  async createMetaProductSet(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?.id || req.workspace?._id;
      const catalogId = String(req.params.catalogId || req.body?.catalogId || '').trim();
      if (!catalogId) return res.status(400).json({ message: 'Product catalog is required.' });

      const { accessToken } = await getMetaAdsTokenForWorkspace(workspaceId);
      const result = await MetaAdsService.createProductSet(accessToken, catalogId, {
        name: String(req.body?.name || '').trim(),
        filter: req.body?.filter,
      });
      res.json({ success: true, data: result.data, metaRequestId: result.metaRequestId });
    } catch (err: any) {
      res.status(err?.statusCode || 400).json({
        message: err?.response?.data?.error?.message || err.message,
        error: err?.response?.data?.error,
      });
    }
  },

  async getInternalMetaAdsConfig(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.params.workspaceId;
      const integration = await (Integration as any).findOne({
        workspace: workspaceId,
        type: 'meta_ads'
      }).select('+config');

      if (!integration || integration.status !== 'connected') {
        return res.status(404).json({ success: false, message: 'Meta Ads is not connected for this workspace.' });
      }

      const storedConfig = integration.getDecryptedConfig?.() || {};
      const selected = storedConfig.selected || integration.configMetadata?.selected || {};
      if (!storedConfig?.tokens?.accessToken || !selected?.adAccountId) {
        return res.status(409).json({ success: false, message: 'Meta Ads is connected but not configured.' });
      }

      res.json({
        success: true,
        data: {
          accessToken: storedConfig.tokens.accessToken,
          tokenExpiresAt: storedConfig.tokens.expiresAt,
          selected,
          metadata: integration.configMetadata || {},
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Petpooja Connect
   */
  async connectPetpooja(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?.id || req.workspace?._id;
      const credentials = PetpoojaService.normalizeCredentials(req.body || {});

      const isValid = await PetpoojaService.validateCredentials(credentials);
      if (!isValid) return res.status(400).json({ message: 'Invalid Petpooja credentials' });

      let integration = await (Integration as any).findOne({
        workspace: workspaceId,
        type: 'petpooja'
      });

      if (!integration) {
        integration = new (Integration as any)({
          workspace: workspaceId,
          type: 'petpooja',
          name: 'Petpooja POS',
          syncDirection: 'pull',
          syncInterval: 5,
          createdBy: req.user?._id || req.user?.id
        });
      }

      (integration as any).setEncryptedConfig(credentials);
      integration.configMetadata = {
        credentialMode: credentials.appKey ? 'official' : 'legacy',
        restId: credentials.restId,
        vendorId: credentials.vendorId,
        connectedAt: new Date()
      };
      integration.status = 'connected';
      integration.updatedBy = req.user?._id || req.user?.id;
      await integration.save();

      res.json({ success: true, message: 'Petpooja connected successfully', integration: integration.toSafeJSON?.() || integration });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  }
};
