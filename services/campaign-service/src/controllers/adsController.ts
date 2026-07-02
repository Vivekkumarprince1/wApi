import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { WhatsAppAd } from '../models';
import { MetaMarketingService, parseMetaInsightsRow } from '../services/MetaMarketingService';

function getWorkspaceId(req: AuthRequest) {
  return req.workspace?.id || req.workspace?._id;
}

function getUserId(req: AuthRequest) {
  return req.user?.id || req.user?._id;
}

function clientError(res: Response, message: string, status = 400) {
  return res.status(status).json({ success: false, message });
}

function normalizeDesiredStatus(raw: any): 'PAUSED' | 'ACTIVE' {
  return String(raw || '').toUpperCase() === 'ACTIVE' ? 'ACTIVE' : 'PAUSED';
}

function mapMetaStatus(metaStatus?: string) {
  if (!metaStatus) return undefined;
  const status = metaStatus.toUpperCase();
  if (status === 'ACTIVE') return 'active';
  if (status === 'PAUSED') return 'paused';
  if (status.includes('REJECTED') || status.includes('DISAPPROVED')) return 'rejected';
  if (status.includes('PENDING') || status.includes('REVIEW')) return 'pending_review';
  if (status.includes('DELETED') || status.includes('ARCHIVED')) return 'completed';
  return undefined;
}

function normalizeAdInput(input: any = {}) {
  const scheduleEnd = input.scheduleEnd ? new Date(input.scheduleEnd) : undefined;
  const budgetType = String(input.budgetType || '').toUpperCase() === 'LIFETIME' && scheduleEnd ? 'LIFETIME' : 'DAILY';
  const bidStrategy = String(input.bidStrategy || 'LOWEST_COST_WITHOUT_CAP').toUpperCase();

  return {
    ...input,
    metaObjective: input.metaObjective || 'OUTCOME_ENGAGEMENT',
    budgetType,
    bidStrategy: ['LOWEST_COST_WITHOUT_CAP', 'LOWEST_COST_WITH_BID_CAP', 'COST_CAP'].includes(bidStrategy)
      ? bidStrategy
      : 'LOWEST_COST_WITHOUT_CAP',
    billingEvent: input.billingEvent || 'IMPRESSIONS',
    optimizationGoal: input.optimizationGoal || 'CONVERSATIONS',
    destinationType: input.destinationType || 'WHATSAPP',
    callToActionType: String(input.callToActionType || 'WHATSAPP_MESSAGE').toUpperCase(),
    displayFormat: String(input.displayFormat || 'TEXT').toUpperCase() === 'CAROUSEL' ? 'CAROUSEL' : 'TEXT',
    carouselCards: Array.isArray(input.carouselCards)
      ? input.carouselCards
          .slice(0, 10)
          .map((card: any) => ({
            headline: String(card?.headline || '').trim(),
            description: String(card?.description || '').trim(),
            imageHash: String(card?.imageHash || '').trim(),
            imageUrl: String(card?.imageUrl || '').trim(),
            link: String(card?.link || '').trim(),
          }))
          .filter((card: any) => card.headline || card.imageHash || card.imageUrl)
      : [],
    isScheduled: Boolean(input.scheduleStart),
    targeting: {
      ageMin: Number(input.targeting?.ageMin || 18),
      ageMax: Number(input.targeting?.ageMax || 65),
      genders: Array.isArray(input.targeting?.genders) && input.targeting.genders.length ? input.targeting.genders : ['ALL'],
      countries: Array.isArray(input.targeting?.countries) && input.targeting.countries.length ? input.targeting.countries : ['IN'],
      languages: input.targeting?.languages || [],
      interests: input.targeting?.interests || [],
      behaviors: input.targeting?.behaviors || [],
      customAudiences: input.targeting?.customAudiences || [],
      lookalikeLevels: input.targeting?.lookalikeLevels || [],
      excludedAudiences: input.targeting?.excludedAudiences || [],
      publisherPlatforms: input.targeting?.publisherPlatforms || [],
      facebookPositions: input.targeting?.facebookPositions || [],
      instagramPositions: input.targeting?.instagramPositions || [],
      devicePlatforms: input.targeting?.devicePlatforms || [],
    },
    scheduleStart: input.scheduleStart ? new Date(input.scheduleStart) : undefined,
    scheduleEnd,
  };
}

function normalizePartialAdInput(input: any = {}) {
  const update: any = { ...input };

  if (input.scheduleStart) update.scheduleStart = new Date(input.scheduleStart);
  if (input.scheduleEnd) update.scheduleEnd = new Date(input.scheduleEnd);
  if (input.budgetType) {
    update.budgetType = String(input.budgetType).toUpperCase() === 'LIFETIME' && (input.scheduleEnd || update.scheduleEnd)
      ? 'LIFETIME'
      : 'DAILY';
  }
  if (input.bidStrategy) {
    const bidStrategy = String(input.bidStrategy).toUpperCase();
    update.bidStrategy = ['LOWEST_COST_WITHOUT_CAP', 'LOWEST_COST_WITH_BID_CAP', 'COST_CAP'].includes(bidStrategy)
      ? bidStrategy
      : 'LOWEST_COST_WITHOUT_CAP';
  }
  if (input.targeting) {
    update.targeting = {
      ...input.targeting,
      ageMin: input.targeting.ageMin === undefined ? undefined : Number(input.targeting.ageMin),
      ageMax: input.targeting.ageMax === undefined ? undefined : Number(input.targeting.ageMax),
    };
  }

  return update;
}

async function addSelectedMetaCommerceDefaults(workspaceId: string, adInput: any) {
  try {
    const config = await MetaMarketingService.getWorkspaceConfig(workspaceId);
    const selected = config.selected || {};
    const metadata = config.metadata?.selected || {};
    return {
      ...adInput,
      currency: adInput.currency || selected.currency || 'INR',
      productCatalogId: adInput.productCatalogId || selected.productCatalogId,
      productCatalogName: adInput.productCatalogName || metadata.productCatalogName,
      productSetId: adInput.productSetId || selected.productSetId,
      productSetName: adInput.productSetName || metadata.productSetName,
    };
  } catch {
    return adInput;
  }
}

function buildMetaLog(action: string, request: any, response?: any, error?: any) {
  return {
    timestamp: new Date(),
    action,
    request,
    response: response?.data || response,
    error: error?.meta?.message || error?.message,
    metaRequestId: response?.metaRequestId || error?.response?.headers?.['x-fb-request-id'] || error?.response?.headers?.['x-fb-trace-id'],
  };
}

async function publishAdDocument(ad: any, workspaceId: string, desiredStatus: 'PAUSED' | 'ACTIVE') {
  const result = await MetaMarketingService.createClickToWhatsAppAd(workspaceId, ad.toObject ? ad.toObject() : ad, desiredStatus);
  ad.metaCampaignId = result.campaign.data.id;
  ad.metaAdSetId = result.adSet.data.id;
  ad.metaAdCreativeId = result.creative.data.id;
  ad.metaAdId = result.ad.data.id;
  ad.metaObjective = ad.metaObjective || 'OUTCOME_ENGAGEMENT';
  ad.metaStatus = desiredStatus;
  ad.metaStatusUpdatedAt = new Date();
  ad.status = desiredStatus === 'ACTIVE' ? 'active' : 'paused';
  ad.metaApiLogs.push(buildMetaLog('publish', { desiredStatus }, {
    data: {
      campaign: result.campaign.data,
      adSet: result.adSet.data,
      creative: result.creative.data,
      ad: result.ad.data,
    },
    metaRequestId: result.ad.metaRequestId,
  }));
  await ad.save();
  return ad;
}

async function syncAdDocument(ad: any, workspaceId: string, since?: string, until?: string) {
  const [remoteStatus, insights] = await Promise.all([
    MetaMarketingService.getAdStatus(workspaceId, ad.metaAdId),
    MetaMarketingService.getInsights(workspaceId, ad.metaAdId, since, until).catch((error) => ({ error })),
  ]);

  const remote = remoteStatus.data;
  const row = Array.isArray((insights as any).data?.data) ? (insights as any).data.data[0] : null;
  ad.metaStatus = remote.effective_status || remote.status || ad.metaStatus;
  ad.metaStatusUpdatedAt = new Date();
  ad.status = mapMetaStatus(ad.metaStatus) || ad.status;
  ad.rejectionDetails = remote.review_feedback || ad.rejectionDetails;
  ad.lastSyncedAt = new Date();
  ad.lastMetaSyncError = undefined;

  if (row) {
    const metrics = parseMetaInsightsRow(row);
    ad.spentAmount = metrics.spentAmount;
    ad.spentAmountUpdatedAt = new Date();
    ad.impressions = metrics.impressions;
    ad.reach = metrics.reach;
    ad.frequency = metrics.frequency;
    ad.clicks = metrics.clicks;
    ad.inlineLinkClicks = metrics.inlineLinkClicks;
    ad.ctr = metrics.ctr;
    ad.cpc = metrics.cpc;
    ad.cpm = metrics.cpm;
    ad.conversions = metrics.conversions;
    ad.results = metrics.results;
    ad.costPerResult = metrics.costPerResult;
    ad.qualityRanking = metrics.qualityRanking;
    ad.engagementRateRanking = metrics.engagementRateRanking;
    ad.conversionRateRanking = metrics.conversionRateRanking;
    ad.actionBreakdown = metrics.actionBreakdown;
    ad.costPerActionType = metrics.costPerActionType;
  }

  ad.metaApiLogs.push(buildMetaLog('sync', { since, until }, {
    data: { status: remote, insights: row || null },
    metaRequestId: remoteStatus.metaRequestId,
  }));
  await ad.save();
  return ad;
}

export const adsController = {
  /**
   * List all ads
   */
  async listAds(req: AuthRequest, res: Response) {
    try {
      const workspaceId = getWorkspaceId(req);
      const ads = await (WhatsAppAd as any).find({ workspace: workspaceId }).sort({ createdAt: -1 });
      res.json({ success: true, data: ads });
    } catch (err: any) {
      res.status(500).json({ success: false, message: "Server Error", error: err.message });
    }
  },

  /**
   * Create new ad
   */
  async createAd(req: AuthRequest, res: Response) {
    try {
      const workspaceId = getWorkspaceId(req);
      const userId = getUserId(req);
      const {
        publishToMeta = false,
        desiredStatus,
        ...adInput
      } = req.body || {};
      const normalizedInput = await addSelectedMetaCommerceDefaults(
        String(workspaceId),
        normalizeAdInput(adInput)
      );

      if (!normalizedInput.name) return clientError(res, 'Ad name is required.');
      if (!normalizedInput.budget || Number(normalizedInput.budget) <= 0) return clientError(res, 'Budget must be greater than zero.');
      if (!normalizedInput.scheduleStart) return clientError(res, 'Schedule start is required.');
      if (normalizedInput.budgetType === 'LIFETIME' && !normalizedInput.scheduleEnd) {
        return clientError(res, 'Lifetime budget requires an end time.');
      }

      const ad = await (WhatsAppAd as any).create({
        ...normalizedInput,
        workspace: workspaceId,
        createdBy: userId,
        status: publishToMeta ? 'pending_review' : (normalizedInput.status || 'draft'),
      });

      if (publishToMeta) {
        try {
          const publishedAd = await publishAdDocument(ad, String(workspaceId), normalizeDesiredStatus(desiredStatus));
          return res.json({ success: true, data: publishedAd });
        } catch (err: any) {
          ad.status = 'error';
          ad.metaApiLogs.push(buildMetaLog('publish', { desiredStatus: normalizeDesiredStatus(desiredStatus) }, undefined, err));
          await ad.save();
          return res.status(502).json({
            success: false,
            message: err?.meta?.message || err.message || 'Meta publish failed',
            error: err?.meta,
            data: ad,
          });
        }
      }

      res.json({ success: true, data: ad });
    } catch (err: any) {
      res.status(500).json({ success: false, message: "Server Error", error: err.message });
    }
  },

  /**
   * Get ad details
   */
  async getAd(req: AuthRequest, res: Response) {
    try {
      const workspaceId = getWorkspaceId(req);
      const ad = await (WhatsAppAd as any).findOne({ _id: req.params.id, workspace: workspaceId });
      if (!ad) return res.status(404).json({ success: false, message: "Ad not found" });
      res.json({ success: true, data: ad });
    } catch (err: any) {
      res.status(500).json({ success: false, message: "Server Error", error: err.message });
    }
  },

  /**
   * Update ad
   */
  async updateAd(req: AuthRequest, res: Response) {
    try {
      const workspaceId = getWorkspaceId(req);
      const normalizedInput = normalizePartialAdInput(req.body);
      const ad = await (WhatsAppAd as any).findOneAndUpdate(
        { _id: req.params.id, workspace: workspaceId },
        { $set: normalizedInput },
        { new: true }
      );
      if (!ad) return res.status(404).json({ success: false, message: "Ad not found" });
      res.json({ success: true, data: ad });
    } catch (err: any) {
      res.status(500).json({ success: false, message: "Server Error", error: err.message });
    }
  },

  /**
   * Delete ad
   */
  async deleteAd(req: AuthRequest, res: Response) {
    try {
      const workspaceId = getWorkspaceId(req);
      const ad = await (WhatsAppAd as any).findOneAndDelete({ _id: req.params.id, workspace: workspaceId });
      if (!ad) return res.status(404).json({ success: false, message: "Ad not found" });
      res.json({ success: true, message: "Ad deleted" });
    } catch (err: any) {
      res.status(500).json({ success: false, message: "Server Error", error: err.message });
    }
  },

  async getMetaAdsReadiness(req: AuthRequest, res: Response) {
    try {
      const workspaceId = String(getWorkspaceId(req));
      const config = await MetaMarketingService.getWorkspaceConfig(workspaceId);
      res.json({
        success: true,
        connected: true,
        configured: Boolean(config.selected?.adAccountId && config.selected?.pageId),
        selected: {
          adAccountId: config.selected?.adAccountId,
          pageId: config.selected?.pageId,
          instagramActorId: config.selected?.instagramActorId,
          whatsappPhoneNumberId: config.selected?.whatsappPhoneNumberId,
          whatsappPhoneNumber: config.selected?.whatsappPhoneNumber ? `***${String(config.selected.whatsappPhoneNumber).slice(-4)}` : undefined,
          productCatalogId: config.selected?.productCatalogId,
          productCatalogName: config.metadata?.selected?.productCatalogName,
          productSetId: config.selected?.productSetId,
          productSetName: config.metadata?.selected?.productSetName,
          currency: config.selected?.currency,
        },
        metadata: {
          tokenExpiresAt: config.tokenExpiresAt,
          configuredAt: config.metadata?.selected?.configuredAt,
          assets: {
            adAccountName: config.metadata?.selected?.adAccountName,
            pageName: config.metadata?.selected?.pageName,
            whatsappDisplayPhoneNumber: config.metadata?.selected?.whatsappDisplayPhoneNumber,
            productCatalogName: config.metadata?.selected?.productCatalogName,
            productSetName: config.metadata?.selected?.productSetName,
          },
        },
      });
    } catch (err: any) {
      res.status(err?.message?.includes('not configured') ? 409 : 404).json({
        success: false,
        connected: false,
        configured: false,
        message: err.message,
      });
    }
  },

  async publishAd(req: AuthRequest, res: Response) {
    const workspaceId = String(getWorkspaceId(req));
    const desiredStatus = normalizeDesiredStatus(req.body?.desiredStatus);
    const ad = await (WhatsAppAd as any).findOne({ _id: req.params.id, workspace: workspaceId });
    if (!ad) return res.status(404).json({ success: false, message: 'Ad not found' });
    if (ad.metaAdId) return res.status(409).json({ success: false, message: 'Ad is already published to Meta.', data: ad });

    try {
      const publishedAd = await publishAdDocument(ad, workspaceId, desiredStatus);
      res.json({ success: true, data: publishedAd });
    } catch (err: any) {
      ad.status = 'error';
      ad.metaApiLogs.push(buildMetaLog('publish', { desiredStatus }, undefined, err));
      await ad.save();
      res.status(502).json({
        success: false,
        message: err?.meta?.message || err.message || 'Meta publish failed',
        error: err?.meta,
        data: ad,
      });
    }
  },

  async updateMetaAdStatus(req: AuthRequest, res: Response) {
    try {
      const workspaceId = String(getWorkspaceId(req));
      const desiredStatus = normalizeDesiredStatus(req.body?.status || req.body?.desiredStatus);
      const ad = await (WhatsAppAd as any).findOne({ _id: req.params.id, workspace: workspaceId });
      if (!ad) return res.status(404).json({ success: false, message: 'Ad not found' });
      if (!ad.metaAdId) return res.status(409).json({ success: false, message: 'Publish the ad before changing Meta status.' });

      const result = await MetaMarketingService.updateAdStatus(workspaceId, ad.metaAdId, desiredStatus);
      ad.metaStatus = desiredStatus;
      ad.metaStatusUpdatedAt = new Date();
      ad.status = desiredStatus === 'ACTIVE' ? 'active' : 'paused';
      if (desiredStatus === 'PAUSED') {
        ad.pausedAt = new Date();
        ad.pausedBy = getUserId(req);
        ad.pausedReason = req.body?.reason || 'Paused by user';
      }
      ad.metaApiLogs.push(buildMetaLog('status.update', { status: desiredStatus }, result));
      await ad.save();

      res.json({ success: true, data: ad });
    } catch (err: any) {
      res.status(502).json({ success: false, message: err?.meta?.message || err.message, error: err?.meta });
    }
  },

  async getMetaAdPreview(req: AuthRequest, res: Response) {
    try {
      const workspaceId = String(getWorkspaceId(req));
      const ad = await (WhatsAppAd as any).findOne({ _id: req.params.id, workspace: workspaceId });
      if (!ad) return res.status(404).json({ success: false, message: 'Ad not found' });
      if (!ad.metaAdId) return res.status(409).json({ success: false, message: 'Ad is not published to Meta yet.' });

      const result = await MetaMarketingService.getAdPreview(
        workspaceId,
        ad.metaAdId,
        String(req.query.adFormat || 'DESKTOP_FEED_STANDARD')
      );
      res.json({ success: true, data: result.data?.data || [], metaRequestId: result.metaRequestId });
    } catch (err: any) {
      res.status(502).json({ success: false, message: err?.meta?.message || err.message, error: err?.meta });
    }
  },

  async syncMetaAd(req: AuthRequest, res: Response) {
    try {
      const workspaceId = String(getWorkspaceId(req));
      const ad = await (WhatsAppAd as any).findOne({ _id: req.params.id, workspace: workspaceId });
      if (!ad) return res.status(404).json({ success: false, message: 'Ad not found' });
      if (!ad.metaAdId) return res.status(409).json({ success: false, message: 'Ad is not published to Meta yet.' });

      const syncedAd = await syncAdDocument(ad, workspaceId, req.query.since as string, req.query.until as string);
      res.json({ success: true, data: syncedAd });
    } catch (err: any) {
      res.status(502).json({ success: false, message: err?.meta?.message || err.message, error: err?.meta });
    }
  },

  async syncAllMetaAds(req: AuthRequest, res: Response) {
    const workspaceId = String(getWorkspaceId(req));
    try {
      const ads = await (WhatsAppAd as any).find({ workspace: workspaceId, metaAdId: { $exists: true, $ne: null } }).sort({ createdAt: -1 });
      const results = [];

      for (const ad of ads) {
        try {
          const synced = await syncAdDocument(ad, workspaceId, req.query.since as string, req.query.until as string);
          results.push({ id: String(synced._id), success: true, data: synced });
        } catch (err: any) {
          ad.lastSyncedAt = new Date();
          ad.lastMetaSyncError = err?.meta?.message || err.message || 'Meta sync failed';
          ad.metaApiLogs.push(buildMetaLog('sync.error', { since: req.query.since, until: req.query.until }, undefined, err));
          await ad.save();
          results.push({ id: String(ad._id), success: false, message: ad.lastMetaSyncError });
        }
      }

      res.json({
        success: true,
        data: {
          total: ads.length,
          synced: results.filter((item) => item.success).length,
          failed: results.filter((item) => !item.success).length,
          results,
        },
      });
    } catch (err: any) {
      res.status(502).json({ success: false, message: err?.meta?.message || err.message, error: err?.meta });
    }
  }
};
