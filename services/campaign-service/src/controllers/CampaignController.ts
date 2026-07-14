import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Campaign, CampaignMessage, ICampaignModel, Template } from '../models';
import { microserviceWorkerClient } from '../lib/microservice-worker-client';
import mongoose, { Types } from 'mongoose';
import { CampaignQueueService } from '../lib/campaign-queue';

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getComponent = (components: any[] = [], type: string) =>
  components.find((component: any) => String(component?.type || '').toUpperCase() === type);

const normalizeTemplate = (template: any) => {
  if (!template) return null;

  const providerData = template.providerData || {};
  const components = Array.isArray(template.components)
    ? template.components
    : Array.isArray(providerData.components)
      ? providerData.components
      : [];
  const body = getComponent(components, 'BODY');
  const header = template.header || providerData.header || getComponent(components, 'HEADER');
  const footer = template.footer || providerData.footer || getComponent(components, 'FOOTER');
  const buttonsComponent = getComponent(components, 'BUTTONS');
  const buttons = template.buttons || providerData.buttons || (Array.isArray(buttonsComponent?.buttons)
    ? { items: buttonsComponent.buttons }
    : undefined);
  const bodyText = template.bodyText || template.body?.text || providerData.bodyText || body?.text || providerData.raw?.data || '';

  return {
    _id: template._id,
    id: template._id?.toString?.() || template.id,
    name: template.name || template.metaTemplateName || providerData.raw?.elementName,
    category: template.category || providerData.raw?.category,
    language: template.language || providerData.raw?.languageCode || 'en',
    status: template.status,
    components,
    bodyText,
    body: { text: bodyText },
    header,
    footer,
    buttons,
    headerType: template.headerType || header?.format || (header ? 'TEXT' : undefined),
    metaTemplateName: template.metaTemplateName,
  };
};

const buildTemplateSnapshot = (template: any, existingSnapshot: any = {}) => {
  const normalized = normalizeTemplate(template);
  if (!normalized) return existingSnapshot || {};

  return {
    name: normalized.name,
    category: normalized.category,
    language: normalized.language,
    headerType: normalized.headerType || 'TEXT',
    bodyText: normalized.bodyText,
    components: normalized.components,
    buttons: normalized.buttons,
    ...existingSnapshot,
  };
};

const loadTemplateForCampaign = async (workspaceId: string, templateId: string) => {
  let localTemplate: any = null;

  try {
    localTemplate = await Template.findOne({ _id: templateId, workspace: workspaceId }).lean();
  } catch {
    localTemplate = null;
  }

  if (localTemplate) return normalizeTemplate(localTemplate);

  try {
    const response = await microserviceWorkerClient.getTemplate(workspaceId, templateId);
    return normalizeTemplate(response?.template || response?.data || response);
  } catch (err: any) {
    console.warn(`[Campaign:Template] Failed to load template ${templateId}: ${err.message}`);
    return null;
  }
};

const getContactFromResponse = (response: any) => response?.contact || response?.data || response;

const getCampaignMessageScope = (campaignId: string, workspaceId: string) => ({
  campaign: new mongoose.Types.ObjectId(campaignId),
  $or: [
    { workspace: new mongoose.Types.ObjectId(workspaceId) },
    { workspace: workspaceId },
    { workspace: { $exists: false } },
    { workspace: null },
  ],
});

/**
 * GET /campaigns — paginated list with aggregate stats
 */
export const listCampaigns = async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = req.workspace?.id;
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '10', 10);
    const type = req.query.type as string;
    const status = req.query.status as string;

    const query: any = { workspace: workspaceId };
    if (type && type !== 'all') {
      query.campaignType = type === 'one-time' ? { $in: ['one-time', null] } : type;
    }
    if (status) query.status = status;

    const [campaigns, total, statsResult] = await Promise.all([
      Campaign.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Campaign.countDocuments(query),
      Campaign.aggregate([
        { $match: { workspace: new mongoose.Types.ObjectId(workspaceId) } },
        { $group: { _id: null, totalSent: { $sum: '$sentCount' }, totalDelivered: { $sum: '$deliveredCount' }, totalRead: { $sum: '$readCount' }, count: { $sum: 1 } } }
      ])
    ]);

    const stats = statsResult[0] || { totalSent: 0, totalDelivered: 0, totalRead: 0, count: 0 };
    const avgDelivery = stats.totalSent > 0 ? (stats.totalDelivered / stats.totalSent) * 100 : 0;
    const avgOpenRate = stats.totalSent > 0 ? (stats.totalRead / stats.totalSent) * 100 : 0;

    res.json({
      success: true,
      campaigns,
      stats: { avgDelivery: parseFloat(avgDelivery.toFixed(1)), avgOpenRate: parseFloat(avgOpenRate.toFixed(1)), totalSent: stats.totalSent, totalCampaigns: stats.count },
      pagination: { total, page, limit, hasMore: page * limit < total }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET /campaigns/:id — single campaign detail
 */
export const getCampaignById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const workspaceId = req.workspace?.id;
    const campaign = await Campaign.findOne({ _id: id, workspace: workspaceId }).lean();
    if (!campaign) return res.status(404).json({ success: false, message: 'Not found' });

    const templateId = (campaign as any).template?.toString?.() || String((campaign as any).template || '');
    const template = templateId ? await loadTemplateForCampaign(String(workspaceId), templateId) : null;
    const templateSnapshot = template
      ? buildTemplateSnapshot(template, (campaign as any).templateSnapshot)
      : (campaign as any).templateSnapshot;

    res.json({
      success: true,
      campaign: {
        ...campaign,
        template: template || (campaign as any).template,
        templateSnapshot,
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * POST /campaigns/create — create a draft campaign
 */
export const createCampaign = async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = req.workspace?.id;
    const userId = req.user?.id;
    const body = req.body;
    const {
      name,
      template,
      templateId: _tid,
      segmentId: _sid,
      contacts: _contacts,
      recipientFilter,
      variableMapping,
      campaignType = 'one-time',
      scheduledAt,
    } = body;
    const templateId = _tid || template;

    if (!name) return res.status(400).json({ success: false, message: 'Campaign name is required' });
    if (!templateId) return res.status(400).json({ success: false, message: 'Template is required' });

    const scheduledDate = scheduledAt ? new Date(scheduledAt) : null;
    if (scheduledAt && Number.isNaN(scheduledDate?.getTime())) {
      return res.status(400).json({ success: false, message: 'scheduledAt must be a valid date-time' });
    }
    if (campaignType === 'scheduled' && !scheduledDate) {
      return res.status(400).json({ success: false, message: 'scheduledAt is required for scheduled campaigns' });
    }
    if (scheduledDate && scheduledDate <= new Date()) {
      return res.status(400).json({ success: false, message: 'scheduledAt must be in the future' });
    }

    // Store contact IDs; the campaign worker performs service-level template,
    // billing, and contact validation before sending.
    let contactIds = Array.isArray(_contacts) ? _contacts : [];
    const totalContacts = body.totalContacts || contactIds.length;

    // 3. Populate Template Snapshot for execution parity.
    let templateSnapshot = body.templateSnapshot || {};
    try {
      const templateDoc = await loadTemplateForCampaign(String(workspaceId), String(templateId));
      templateSnapshot = buildTemplateSnapshot(templateDoc, templateSnapshot);
    } catch (err) {
      console.warn('[Campaign:Create] Failed to populate template snapshot:', err);
    }

    const isScheduled = !!scheduledDate || campaignType === 'scheduled';
    const campaign = await Campaign.create({
      workspace: workspaceId,
      name,
      template: templateId,
      templateSnapshot,
      recipientFilter: _sid ? { type: 'segment', segmentId: _sid } : recipientFilter,
      contacts: contactIds,
      variableMapping,
      campaignType: isScheduled ? 'scheduled' : campaignType,
      status: isScheduled ? 'SCHEDULED' : 'DRAFT',
      scheduledAt: scheduledDate || undefined,
      scheduleAt: scheduledDate || undefined,
      createdBy: userId,
      totalContacts
    });

    res.status(201).json({ success: true, message: 'Campaign created successfully', campaign });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createBulkCampaign = async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = String(req.workspace?.id || req.workspace?._id || '');
    const userId = String(req.user?.id || req.user?._id || '');
    const contactIds = Array.isArray(req.body?.contactIds)
      ? [...new Set<string>(req.body.contactIds.map((value: unknown) => String(value)))]
        .filter((value) => Types.ObjectId.isValid(value))
        .map((value) => new Types.ObjectId(value))
      : [];
    const templateId = String(req.body?.templateId || req.body?.template?._id || req.body?.template || '');
    const scheduledAt = req.body?.scheduledAt ? new Date(req.body.scheduledAt) : null;

    if (!workspaceId || !userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authenticated workspace is required' } });
    if (!contactIds.length || contactIds.length > 100000) return res.status(400).json({ success: false, error: { code: 'INVALID_AUDIENCE', message: 'contactIds must contain between 1 and 100000 contacts' } });
    if (!templateId || !Types.ObjectId.isValid(templateId)) return res.status(400).json({ success: false, error: { code: 'INVALID_TEMPLATE', message: 'A valid approved template is required' } });
    if (scheduledAt && Number.isNaN(scheduledAt.getTime())) return res.status(400).json({ success: false, error: { code: 'INVALID_SCHEDULE', message: 'scheduledAt must be a valid date-time' } });

    const template = await loadTemplateForCampaign(workspaceId, templateId);
    if (String(template?.status || '').toUpperCase() !== 'APPROVED') {
      return res.status(409).json({ success: false, error: { code: 'TEMPLATE_NOT_APPROVED', message: 'Only provider-approved templates can be sent' } });
    }

    const idempotencyKey = String(req.header('idempotency-key') || req.header('x-idempotency-key') || '').trim();
    if (idempotencyKey) {
      const existing = await Campaign.findOne({ workspace: workspaceId, 'metadata.idempotencyKey': idempotencyKey });
      if (existing) return res.status(202).json({ success: true, operationId: existing._id, campaignId: existing._id, status: existing.status });
    }

    const campaign: any = await Campaign.create({
      workspace: workspaceId,
      name: String(req.body?.name || `Bulk send ${new Date().toISOString()}`).slice(0, 120),
      template: templateId,
      templateSnapshot: buildTemplateSnapshot(template),
      recipientFilter: { type: 'specific' },
      contacts: contactIds,
      variableMapping: req.body?.variableMapping || {},
      campaignType: scheduledAt ? 'scheduled' : 'one-time',
      status: scheduledAt ? 'SCHEDULED' : 'DRAFT',
      scheduledAt: scheduledAt || undefined,
      scheduleAt: scheduledAt || undefined,
      createdBy: userId,
      totalContacts: contactIds.length,
      metadata: { idempotencyKey: idempotencyKey || undefined, source: 'bulk-api', correlationId: req.header('x-correlation-id') },
    });

    const delay = scheduledAt ? Math.max(0, scheduledAt.getTime() - Date.now()) : 0;
    await CampaignQueueService.enqueue(String(campaign._id), workspaceId, { delay });
    if (!scheduledAt) {
      campaign.status = 'QUEUED';
      await campaign.save();
    }

    return res.status(202).json({
      success: true,
      operationId: campaign._id,
      campaignId: campaign._id,
      status: campaign.status,
      statusUrl: `/api/v1/bulk/status/${campaign._id}`,
    });
  } catch (error: any) {
    return res.status(error?.response?.status || 500).json({ success: false, error: { code: error.code || 'BULK_CAMPAIGN_CREATE_FAILED', message: error.message } });
  }
};

export const getBulkCampaignStatus = async (req: AuthRequest, res: Response) => {
  const workspaceId = String(req.workspace?.id || req.workspace?._id || '');
  const campaign = await Campaign.findOne({ _id: req.params.id, workspace: workspaceId }).lean();
  if (!campaign) return res.status(404).json({ success: false, error: { code: 'OPERATION_NOT_FOUND', message: 'Bulk operation not found' } });
  const messageCounts = await (CampaignMessage as any).getStatusCounts(campaign._id);
  return res.json({ success: true, operationId: campaign._id, status: campaign.status, totals: campaign.totals, messageCounts, updatedAt: campaign.updatedAt });
};

/**
 * PUT /campaigns/:id — update a draft/scheduled/paused campaign
 */
export const updateCampaign = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const workspaceId = req.workspace?.id;
    const updates = req.body;

    const campaign = await Campaign.findOneAndUpdate(
      { _id: id, workspace: workspaceId, status: { $in: ['DRAFT', 'SCHEDULED', 'PAUSED'] } },
      { $set: updates },
      { returnDocument: 'after' }
    );
    if (!campaign) return res.status(404).json({ success: false, message: 'Not found or cannot edit in current status' });
    res.json({ success: true, campaign });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * DELETE /campaigns/:id
 */
export const deleteCampaign = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const workspaceId = req.workspace?.id;
    const campaign = await Campaign.findOneAndDelete({ _id: id, workspace: workspaceId });
    if (!campaign) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * POST /campaigns/:id/lifecycle — start/pause/resume.
 */
export const lifecycleAction = async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) return res.status(400).json({ success: false, message: 'Campaign id is required' });
    const workspaceId = req.workspace?.id;
    const userId = req.user?.id;
    const { action } = req.body;

    const campaign = await Campaign.findOne({ _id: id, workspace: workspaceId });
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });

    if (action === 'start' || action === 'resume') {
      const isResume = campaign.status === 'PAUSED';
      if (!isResume && !['DRAFT', 'SCHEDULED', 'PAUSED'].includes(campaign.status)) {
        return res.status(400).json({ success: false, message: `Cannot start campaign in ${campaign.status} status` });
      }
      if (action === 'resume' && campaign.status !== 'PAUSED') {
        return res.status(400).json({ success: false, message: 'Only paused campaigns can be resumed' });
      }

      // Don't flip status to RUNNING here. The EventBus's
      // BudgetReservedEvent handler does that after billing has actually
      // parked the funds; otherwise the UI/API would briefly report RUNNING
      // with no reservation if billing fails downstream.
      campaign.pausedAt = null;
      campaign.pausedReason = null;
      campaign.startedAt = campaign.startedAt || new Date();
      await campaign.save();

      let startResult: any;
      try {
        const { CampaignService } = await import('../services/CampaignService');
        startResult = await CampaignService.startCampaign(id as string, workspaceId as string, userId as string);
        console.log(`[Lifecycle] Campaign ${id} start requested; awaiting budget reservation`);
      } catch (err: any) {
        console.error(`[Lifecycle] Failed to start campaign:`, err.message);
        return res.status(500).json({ success: false, error: err.message });
      }

      return res.json({
        success: true,
        message: isResume ? 'Campaign resume requested' : 'Campaign start requested',
        data: { status: startResult?.status || 'QUEUED', awaitingBudget: true }
      });
    }

    if (action === 'pause') {
      if (!['RUNNING', 'QUEUED'].includes(campaign.status)) {
        return res.status(400).json({ success: false, message: 'Only running or queued campaigns can be paused' });
      }
      campaign.status = 'PAUSED';
      campaign.pausedReason = 'USER_PAUSED';
      campaign.pausedAt = new Date();
      await (Campaign as ICampaignModel).addAuditEntry(id as string, 'PAUSED', { userId, reason: 'Campaign paused via lifecycle action' });
      await campaign.save();

      // Cancel pending BullMQ jobs directly
      try {
        const { CampaignQueueService } = await import('../lib/campaign-queue');
        await CampaignQueueService.cancelJobs(id as string);
        console.log(`[Lifecycle] ✅ Direct BullMQ job cancellation success for campaign ${id}`);
      } catch (queueErr: any) {
        console.error(`[Lifecycle] ❌ Failed to cancel jobs directly:`, queueErr.message);
      }

      return res.json({ success: true, message: 'Campaign paused', data: { status: 'PAUSED' } });
    }

    res.status(400).json({ success: false, message: 'Invalid action' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET /campaigns/:id/messages — paginated recipient logs
 */
export const getMessages = async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) return res.status(400).json({ success: false, message: 'Campaign id is required' });
    const workspaceId = req.workspace?.id;
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '20', 10);
    const status = req.query.status as string;
    const search = String(req.query.search || '').trim();

    const campaign = await Campaign.findOne({ _id: id, workspace: workspaceId }).select('_id workspace').lean();
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });

    const query: any = getCampaignMessageScope(id, String(workspaceId));
    if (status && status !== 'all') query.status = status;

    if (search) {
      const pattern = escapeRegex(search);
      const searchRegex = new RegExp(pattern, 'i');
      let matchingContactIds: any[] = [];

      try {
        const contactResponse = await microserviceWorkerClient.queryContacts(String(workspaceId), {
          $or: [
            { name: { $regex: pattern, $options: 'i' } },
            { phone: { $regex: pattern, $options: 'i' } },
            { 'metadata.email': { $regex: pattern, $options: 'i' } },
            { 'metadata.whatsappName': { $regex: pattern, $options: 'i' } },
          ],
        });
        matchingContactIds = Array.isArray(contactResponse?.contacts) ? contactResponse.contacts : [];
      } catch (err: any) {
        console.warn(`[Campaign:Messages] Contact search failed for campaign ${id}: ${err.message}`);
      }

      query.$and = [
        {
          $or: [
            { phone: searchRegex },
            { whatsappMessageId: searchRegex },
            { failureReason: searchRegex },
            { lastError: searchRegex },
            ...(matchingContactIds.length > 0 ? [{ contact: { $in: matchingContactIds } }] : []),
          ],
        },
      ];
    }

    const [messages, total] = await Promise.all([
      CampaignMessage.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      CampaignMessage.countDocuments(query)
    ]);

    const contactIds = [...new Set(messages.map((message: any) => message.contact?.toString?.() || String(message.contact || '')).filter(Boolean))];
    const contactCache = new Map<string, any>();

    await Promise.all(contactIds.map(async (contactId) => {
      try {
        const response = await microserviceWorkerClient.getContact(String(workspaceId), contactId);
        const contact = getContactFromResponse(response);
        if (contact) contactCache.set(contactId, contact);
      } catch (err: any) {
        console.warn(`[Campaign:Messages] Failed to hydrate contact ${contactId}: ${err.message}`);
      }
    }));

    const enrichedMessages = messages.map((message: any) => {
      const contactId = message.contact?.toString?.() || String(message.contact || '');
      const contact = contactCache.get(contactId);

      return {
        ...message,
        contact: contact ? {
          _id: contact._id || contactId,
          name: contact.name,
          displayName: contact.displayName,
          phone: contact.phone,
          email: contact.metadata?.email,
          whatsappName: contact.metadata?.whatsappName,
          tags: contact.tags || [],
          leadStatus: contact.leadStatus,
          optOut: contact.optOut,
        } : { _id: contactId },
      };
    });

    res.json({ success: true, messages: enrichedMessages, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET /campaigns/:id/export — CSV download
 */
export const exportCsv = async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) return res.status(400).json({ success: false, message: 'Campaign id is required' });
    const workspaceId = req.workspace?.id;

    const campaign = await Campaign.findOne({ _id: id, workspace: workspaceId });
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });

    const messages = await CampaignMessage.find(getCampaignMessageScope(id, String(workspaceId))).sort({ createdAt: 1 }).lean();

    const headers = ['Phone', 'Status', 'Sent At', 'Delivered At', 'Read At', 'Error Reason'];
    const rows = messages.map((m: any) => [
      m.phone || '',
      (m.status || '').toUpperCase(),
      m.sentAt ? new Date(m.sentAt).toISOString() : '',
      m.deliveredAt ? new Date(m.deliveredAt).toISOString() : '',
      m.readAt ? new Date(m.readAt).toISOString() : '',
      `"${m.failureReason || m.lastError || ''}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const filename = `campaign_report_${campaign.name.replace(/\s+/g, '_').toLowerCase()}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * POST /campaigns/:id/retarget — create a retargeting clone
 */
export const retargetCampaign = async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) return res.status(400).json({ success: false, message: 'Campaign id is required' });
    const workspaceId = req.workspace?.id;
    const userId = req.user?.id;

    const parent = await Campaign.findOne({ _id: id, workspace: workspaceId });
    if (!parent) return res.status(404).json({ success: false, message: 'Campaign not found' });

    // Find non-read recipients
    const nonReadMessages = await CampaignMessage.find({
      ...getCampaignMessageScope(id, String(workspaceId)),
      status: { $ne: 'read' },
    }).distinct('contact');
    if (nonReadMessages.length === 0) return res.status(400).json({ success: false, message: 'No targets found for retargeting' });

    const retarget = await Campaign.create({
      workspace: workspaceId,
      name: `🎯 Retarget: ${parent.name}`,
      template: parent.template,
      templateSnapshot: parent.templateSnapshot,
      variableMapping: parent.variableMapping,
      contacts: nonReadMessages,
      campaignType: 'one-time',
      status: 'DRAFT',
      createdBy: userId,
      totalContacts: nonReadMessages.length
    });

    res.status(201).json({ success: true, message: `Retargeting campaign created with ${nonReadMessages.length} recipients`, campaign: retarget });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const purgeWorkspaceData = async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    if (!workspaceId) {
      return res.status(400).json({ success: false, message: 'Workspace ID is required' });
    }

    await Promise.all([
      CampaignMessage.deleteMany({ workspace: workspaceId }),
      Campaign.deleteMany({ workspace: workspaceId }),
    ]);

    const { Segment } = await import('../models');
    await Segment.deleteMany({ workspace: workspaceId });

    res.json({ success: true, message: 'Workspace campaign data purged' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};
