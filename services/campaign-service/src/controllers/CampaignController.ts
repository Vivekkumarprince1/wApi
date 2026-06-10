import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Campaign, CampaignMessage, ICampaignModel } from '../models';
import mongoose from 'mongoose';

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
    res.json({ success: true, campaign });
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
    const { name, template, templateId: _tid, segmentId: _sid, contacts: _contacts, recipientFilter, variableMapping, campaignType = 'one-time' } = body;
    const templateId = _tid || template;

    if (!name) return res.status(400).json({ success: false, message: 'Campaign name is required' });
    if (!templateId) return res.status(400).json({ success: false, message: 'Template is required' });

    // Store contact IDs; the campaign worker performs service-level template,
    // billing, and contact validation before sending.
    let contactIds = Array.isArray(_contacts) ? _contacts : [];
    const totalContacts = body.totalContacts || contactIds.length;

    // 3. Populate Template Snapshot for execution parity.
    let templateSnapshot = body.templateSnapshot || {};
    try {
      const { Template } = await import('../models');
      const templateDoc = await Template.findById(templateId).lean();
      if (templateDoc) {
        templateSnapshot = {
          name: (templateDoc as any).name,
          category: (templateDoc as any).category,
          language: (templateDoc as any).language,
          headerType: (templateDoc as any).components?.find((c: any) => c.type === 'HEADER')?.format || 'TEXT',
          ...templateSnapshot
        };
      }
    } catch (err) {
      console.warn('[Campaign:Create] Failed to populate template snapshot:', err);
    }

    const campaign = await Campaign.create({
      workspace: workspaceId,
      name,
      template: templateId,
      templateSnapshot,
      recipientFilter: _sid ? { type: 'segment', segmentId: _sid } : recipientFilter,
      contacts: contactIds,
      variableMapping,
      campaignType,
      status: 'DRAFT',
      createdBy: userId,
      totalContacts
    });

    res.status(201).json({ success: true, message: 'Campaign created successfully', campaign });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
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

      try {
        const { CampaignService } = await import('../services/CampaignService');
        await CampaignService.startCampaign(id as string, workspaceId as string, userId as string);
        console.log(`[Lifecycle] Campaign ${id} start requested; awaiting budget reservation`);
      } catch (err: any) {
        console.error(`[Lifecycle] Failed to start campaign:`, err.message);
        return res.status(500).json({ success: false, error: err.message });
      }

      return res.json({
        success: true,
        message: isResume ? 'Campaign resume requested' : 'Campaign start requested',
        data: { status: campaign.status, awaitingBudget: true }
      });
    }

    if (action === 'pause') {
      if (campaign.status !== 'RUNNING') return res.status(400).json({ success: false, message: 'Only running campaigns can be paused' });
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

    const query: any = { workspace: workspaceId, campaign: new mongoose.Types.ObjectId(id) };
    if (status && status !== 'all') query.status = status;

    const [messages, total] = await Promise.all([
      CampaignMessage.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      CampaignMessage.countDocuments(query)
    ]);

    res.json({ success: true, messages, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
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

    const messages = await CampaignMessage.find({ workspace: workspaceId, campaign: id }).sort({ createdAt: 1 }).lean();

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
    const { id } = req.params;
    const workspaceId = req.workspace?.id;
    const userId = req.user?.id;

    const parent = await Campaign.findOne({ _id: id, workspace: workspaceId });
    if (!parent) return res.status(404).json({ success: false, message: 'Campaign not found' });

    // Find non-read recipients
    const nonReadMessages = await CampaignMessage.find({ campaign: id, workspace: workspaceId, status: { $ne: 'read' } }).distinct('contact');
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
